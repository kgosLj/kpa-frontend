<template>
  <t-card title="监控趋势" :bordered="false" class="metrics-chart-card">
    <template #actions>
      <div class="time-range-controls">
        <t-radio-group v-model="timeRange" variant="default-filled" size="small" @change="handleRangeChange">
          <t-radio-button value="1h">1小时</t-radio-button>
          <t-radio-button value="6h">6小时</t-radio-button>
          <t-radio-button value="24h">24小时</t-radio-button>
          <t-radio-button value="custom">自定义</t-radio-button>
        </t-radio-group>
        <t-date-range-picker v-if="timeRange === 'custom'" v-model="customTimeRange" enable-time-picker
          format="YYYY-MM-DD HH:mm" :clearable="false" size="small" style="margin-left: 8px; width: 320px;"
          @change="handleCustomRangeChange" />
      </div>
    </template>

    <t-loading :loading="loading" size="small">
      <div ref="chartContainer" class="chart-container" v-show="hasData"></div>
      <div v-show="!hasData" class="empty-state">
        <t-icon name="info-circle" size="48px" />
        <p class="empty-text">{{ emptyMessage }}</p>
        <p class="empty-hint">{{ emptyHint }}</p>
      </div>
    </t-loading>
  </t-card>
</template>

<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import * as echarts from 'echarts';
import dayjs from 'dayjs';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { getCPUHistory, getMemoryHistory, type MetricsHistoryResponse } from '@/api/dashboard';

defineOptions({
  name: 'MetricsChart',
});

const props = defineProps<{
  clusterId: string;
}>();

const chartContainer = ref<HTMLElement>();
const chart = ref<echarts.ECharts>();
const loading = ref(false);
const timeRange = ref('1h');
const customTimeRange = ref<[string, string]>(['', '']);
const refreshInterval = ref<number>();
const hasData = ref(false);
const dataPointCount = ref(0);

// 空状态消息
const emptyMessage = computed(() => {
  return '监控数据暂不可用';
});

const emptyHint = computed(() => {
  return '请确保 Prometheus 已正确配置，并检查集群连接状态';
});

// 获取监控数据
const fetchMetricsHistory = async () => {
  if (!props.clusterId) return;

  loading.value = true;
  try {
    let range = timeRange.value;

    // 如果是自定义时间范围，构造 Unix 时间戳范围字符串 (start,end)
    if (timeRange.value === 'custom' && customTimeRange.value[0] && customTimeRange.value[1]) {
      const start = Math.floor(new Date(customTimeRange.value[0]).getTime() / 1000);
      const end = Math.floor(new Date(customTimeRange.value[1]).getTime() / 1000);
      range = `${start},${end}`;
    }

    const [cpuRes, memoryRes] = await Promise.all([
      getCPUHistory(props.clusterId, range),
      getMemoryHistory(props.clusterId, range),
    ]);

    // 检查是否有数据
    const hasCpuData = cpuRes && cpuRes.values && cpuRes.values.length > 0;
    const hasMemData = memoryRes && memoryRes.values && memoryRes.values.length > 0;

    // 如果没有任何数据，不显示图表
    if (!hasCpuData && !hasMemData) {
      hasData.value = false;
      dataPointCount.value = 0;
      // 如果之前有图表，清理掉以释放资源
      if (chart.value) {
        chart.value.dispose();
        chart.value = undefined;
      }
      return;
    }

    const totalDataPoints = (hasCpuData ? cpuRes.values.length : 0) + (hasMemData ? memoryRes.values.length : 0);
    dataPointCount.value = totalDataPoints;
    hasData.value = true;

    // 1. 等待 v-show 使得 DOM 可见
    await nextTick();

    // 2. 只有在 DOM 可见且 chart 实例未初始化时，才进行初始化
    if (!chart.value && chartContainer.value) {
      chart.value = echarts.init(chartContainer.value);
      window.addEventListener('resize', handleResize);
    }

    // 3. 此时 chart 一定存在且 DOM 可见，安全 resize
    if (chart.value) {
      try {
        chart.value.resize();
      } catch (e) {
        console.warn('Failed to resize chart:', e);
      }
    }

    // 4. 渲染数据
    renderChart(cpuRes, memoryRes);

    // 如果是自定义时间范围，不需要定时刷新; 否则开启定时刷新
    if (timeRange.value === 'custom') {
      stopAutoRefresh();
    } else {
      startAutoRefresh();
    }
  } catch (error) {
    console.error('Failed to fetch metrics history:', error);
    MessagePlugin.error('获取监控数据失败');
    hasData.value = false;
    dataPointCount.value = 0;
  } finally {
    loading.value = false;
  }
};

// 渲染图表
const renderChart = (cpuData: MetricsHistoryResponse, memoryData: MetricsHistoryResponse) => {
  if (!chart.value || !chartContainer.value) return;

  // 判断内存数据是百分比还是绝对值（MB）
  const isMemoryPercentage = memoryData.values.length > 0 && memoryData.values[0].value <= 100;

  // 计算X轴的时间范围
  let xAxisMin: number | undefined;
  let xAxisMax: number | undefined;

  // 只有在自定义时间时，强制使用用户选择的时间范围作为 X 轴边界
  // 这样保证图表精确显示用户所选的时间段，避免数据稀疏时填满图表

  const now = new Date().getTime();

  switch (timeRange.value) {
    case '1h':
      xAxisMax = now;
      xAxisMin = xAxisMax - 3600 * 1000;
      break;
    case '6h':
      xAxisMax = now;
      xAxisMin = xAxisMax - 6 * 3600 * 1000;
      break;
    case '24h':
      xAxisMax = now;
      xAxisMin = xAxisMax - 24 * 3600 * 1000;
      break;
    case 'custom':
      if (customTimeRange.value[0] && customTimeRange.value[1]) {
        xAxisMin = new Date(customTimeRange.value[0]).getTime();
        xAxisMax = new Date(customTimeRange.value[1]).getTime();
      }
      break;
  }

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return '';
        const time = new Date(params[0].axisValue).toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
        let result = `<div style="font-weight: bold; margin-bottom: 4px;">${time}</div>`;
        params.forEach((param: any) => {
          const value = param.seriesName.includes('内存') && !isMemoryPercentage
            ? `${param.value[1].toFixed(1)} MB`
            : `${param.value[1].toFixed(1)}%`;
          result += `<div>${param.marker}<span style="margin-left: 4px;">${param.seriesName}:</span> <span style="font-weight: bold; margin-left: 8px;">${value}</span></div>`;
        });
        return result;
      },
    },
    legend: {
      data: ['CPU 使用率', isMemoryPercentage ? '内存使用率' : '内存使用量'],
      bottom: 0,
      textStyle: {
        fontSize: 13,
      },
    },
    grid: {
      left: '3%',
      right: isMemoryPercentage ? '3%' : '5%',
      bottom: '60px',
      top: '40px',
      containLabel: true,
    },
    xAxis: {
      type: 'time',
      min: xAxisMin,
      max: xAxisMax,
      axisLabel: {
        formatter: (value: number) => {
          const date = new Date(value);
          return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        },
        fontSize: 12,
        showMaxLabel: true,
        showMinLabel: true,
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: '#e5e5e5',
          type: 'dashed',
        },
      },
    },
    yAxis: isMemoryPercentage
      ? {
        type: 'value',
        name: '使用率 (%)',
        nameTextStyle: {
          fontSize: 13,
          padding: [0, 0, 0, 10],
        },
        min: 0,
        max: 100,
        axisLabel: {
          formatter: '{value}%',
          fontSize: 12,
        },
        splitLine: {
          lineStyle: {
            color: '#e5e5e5',
            type: 'dashed',
          },
        },
      }
      : [
        {
          type: 'value',
          name: 'CPU (%)',
          nameTextStyle: {
            fontSize: 13,
            color: '#0052d9',
            padding: [0, 0, 0, 10],
          },
          min: 0,
          max: 100,
          position: 'left',
          axisLabel: {
            formatter: '{value}%',
            fontSize: 12,
            color: '#0052d9',
          },
          axisLine: {
            show: true,
            lineStyle: {
              color: '#0052d9',
            },
          },
          splitLine: {
            show: true,
            lineStyle: {
              color: '#e5e5e5',
              type: 'dashed',
            },
          },
        },
        {
          type: 'value',
          name: '内存 (MB)',
          nameTextStyle: {
            fontSize: 13,
            color: '#00a870',
            padding: [0, 10, 0, 0],
          },
          position: 'right',
          axisLabel: {
            formatter: '{value}',
            fontSize: 12,
            color: '#00a870',
          },
          axisLine: {
            show: true,
            lineStyle: {
              color: '#00a870',
            },
          },
          splitLine: {
            show: false,
          },
        },
      ],
    series: [
      {
        name: 'CPU 使用率',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        sampling: 'lttb',
        yAxisIndex: 0,
        itemStyle: {
          color: '#0052d9',
        },
        lineStyle: {
          width: 2,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 82, 217, 0.3)' },
            { offset: 1, color: 'rgba(0, 82, 217, 0.05)' },
          ]),
        },
        data: cpuData.values.map((v) => [v.timestamp * 1000, v.value]),
      },
      {
        name: isMemoryPercentage ? '内存使用率' : '内存使用量',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        sampling: 'lttb',
        yAxisIndex: isMemoryPercentage ? 0 : 1,
        itemStyle: {
          color: '#00a870',
        },
        lineStyle: {
          width: 2,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 168, 112, 0.3)' },
            { offset: 1, color: 'rgba(0, 168, 112, 0.05)' },
          ]),
        },
        data: memoryData.values.map((v) => [v.timestamp * 1000, v.value]),
      },
    ],
  };

  chart.value.setOption(option, true);
};

// 时间范围切换
const handleRangeChange = () => {
  if (timeRange.value === 'custom') {
    // 切换到自定义时，不立即请求，等用户选好时间
    stopAutoRefresh();
    // 初始化自定义时间范围为最近1小时，使用 dayjs 确保使用本地时区
    const now = dayjs();
    const oneHourAgo = now.subtract(1, 'hour');
    customTimeRange.value = [
      oneHourAgo.format('YYYY-MM-DD HH:mm'),
      now.format('YYYY-MM-DD HH:mm')
    ];
  } else {
    // 切换回预设时间，重新开始自动刷新
    startAutoRefresh();
    fetchMetricsHistory();
  }
};

// 自定义时间范围变化
const handleCustomRangeChange = () => {
  if (customTimeRange.value && customTimeRange.value[0] && customTimeRange.value[1]) {
    fetchMetricsHistory();
  }
};

const startAutoRefresh = () => {
  stopAutoRefresh();
  refreshInterval.value = window.setInterval(() => {
    fetchMetricsHistory();
  }, 30000);
};

const stopAutoRefresh = () => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value);
    refreshInterval.value = undefined;
  }
};

const handleResize = () => {
  chart.value?.resize();
};

// 清理
const cleanup = () => {
  stopAutoRefresh();
  window.removeEventListener('resize', handleResize);
  chart.value?.dispose();
};

// 监听集群变化
watch(() => props.clusterId, (newId) => {
  if (newId) {
    // ID 变化时重新获取
    fetchMetricsHistory();
  }
});

// 初始化及生命周期
onMounted(() => {
  fetchMetricsHistory();
  startAutoRefresh();
});

onUnmounted(() => {
  cleanup();
});
</script>

<style lang="less" scoped>
.metrics-chart-card {
  height: 100%;

  :deep(.t-card__body) {
    padding: var(--td-comp-paddingTB-xl) var(--td-comp-paddingLR-xl);
  }
}

.time-range-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-container {
  width: 100%;
  height: 400px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  gap: var(--td-comp-margin-s);
  color: var(--td-text-color-secondary);
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-default);

  .t-icon {
    color: var(--td-brand-color);
    margin-bottom: var(--td-comp-margin-s);
  }

  .empty-text {
    font-size: var(--td-font-size-title-medium);
    font-weight: 500;
    margin: 0;
  }

  .empty-hint {
    font-size: var(--td-font-size-body-medium);
    color: var(--td-text-color-placeholder);
    margin: 0;
  }
}
</style>
