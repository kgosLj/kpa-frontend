<template>
  <t-card title="监控趋势" :bordered="false" class="metrics-chart-card">
    <template #actions>
      <t-radio-group v-model="timeRange" variant="default-filled" size="small" @change="handleRangeChange">
        <t-radio-button value="1h">1小时</t-radio-button>
        <t-radio-button value="6h">6小时</t-radio-button>
        <t-radio-button value="24h">24小时</t-radio-button>
      </t-radio-group>
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
const refreshInterval = ref<number>();
const hasData = ref(false);
const dataPointCount = ref(0);

// 空状态消息
const emptyMessage = computed(() => {
  if (dataPointCount.value === 1) {
    return '正在收集监控数据...';
  }
  return 'CPU 和内存使用率监控数据不可用';
});

const emptyHint = computed(() => {
  if (dataPointCount.value === 1) {
    return 'Prometheus 正在采集数据，请等待 5-10 分钟后刷新页面';
  }
  return '请确保 Prometheus 已正确配置节点和容器监控';
});

// 获取监控数据
const fetchMetricsHistory = async () => {
  if (!props.clusterId) return;

  loading.value = true;
  try {
    const [cpuRes, memoryRes] = await Promise.all([
      getCPUHistory(props.clusterId, timeRange.value),
      getMemoryHistory(props.clusterId, timeRange.value),
    ]);

    const totalDataPoints = cpuRes.values.length + memoryRes.values.length;
    dataPointCount.value = totalDataPoints;

    // 需要至少 4 个数据点才能绘制有意义的曲线
    // 但即使只有 1 个点，也要显示提示信息
    if (totalDataPoints < 4) {
      hasData.value = false;
      return;
    }

    hasData.value = true;
    renderChart(cpuRes, memoryRes);
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
      left: '70px',
      right: isMemoryPercentage ? '70px' : '90px',
      bottom: '60px',
      top: '40px',
      containLabel: false,
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        formatter: (value: number) => {
          const date = new Date(value * 1000);
          return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        },
        fontSize: 12,
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
  fetchMetricsHistory();
};

// 初始化图表
const initChart = () => {
  // 使用 nextTick 确保 DOM 已经渲染
  nextTick(() => {
    if (!chartContainer.value) {
      console.warn('Chart container not found');
      return;
    }

    chart.value = echarts.init(chartContainer.value);

    // 监听窗口大小变化
    window.addEventListener('resize', handleResize);
    fetchMetricsHistory();

    // 定时刷新 (30秒)
    refreshInterval.value = window.setInterval(() => {
      fetchMetricsHistory();
    }, 30000);
  });
};

const handleResize = () => {
  chart.value?.resize();
};

// 清理
const cleanup = () => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value);
  }
  window.removeEventListener('resize', handleResize);
  chart.value?.dispose();
};

// 监听集群变化
watch(() => props.clusterId, (newId) => {
  if (newId && chart.value) {
    fetchMetricsHistory();
  }
});

onMounted(() => {
  initChart();
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
