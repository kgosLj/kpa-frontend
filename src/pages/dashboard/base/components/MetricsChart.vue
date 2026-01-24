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
      <div ref="chartContainer" class="chart-container"></div>
    </t-loading>
  </t-card>
</template>

<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import * as echarts from 'echarts';
import { onMounted, onUnmounted, ref, watch } from 'vue';
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

// 获取监控数据
const fetchMetricsHistory = async () => {
  if (!props.clusterId) return;

  loading.value = true;
  try {
    const [cpuRes, memoryRes] = await Promise.all([
      getCPUHistory(props.clusterId, timeRange.value),
      getMemoryHistory(props.clusterId, timeRange.value),
    ]);

    renderChart(cpuRes, memoryRes);
  } catch (error) {
    console.error('Failed to fetch metrics history:', error);
    MessagePlugin.error('获取监控数据失败');
  } finally {
    loading.value = false;
  }
};

// 渲染图表
const renderChart = (cpuData: MetricsHistoryResponse, memoryData: MetricsHistoryResponse) => {
  if (!chart.value || !chartContainer.value) return;

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
    },
    legend: {
      data: ['CPU 使用率', '内存使用率'],
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '5%',
      containLabel: true,
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        formatter: (value: number) => {
          const date = new Date(value * 1000);
          return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        },
      },
    },
    yAxis: {
      type: 'value',
      name: '使用率 (%)',
      min: 0,
      max: 100,
      axisLabel: {
        formatter: '{value}%',
      },
    },
    series: [
      {
        name: 'CPU 使用率',
        type: 'line',
        smooth: true,
        symbol: 'none',
        sampling: 'lttb',
        itemStyle: {
          color: '#0052d9',
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 82, 217, 0.3)' },
            { offset: 1, color: 'rgba(0, 82, 217, 0.0)' },
          ]),
        },
        data: cpuData.values.map((v) => [v.timestamp * 1000, v.value]),
      },
      {
        name: '内存使用率',
        type: 'line',
        smooth: true,
        symbol: 'none',
        sampling: 'lttb',
        itemStyle: {
          color: '#00a870',
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 168, 112, 0.3)' },
            { offset: 1, color: 'rgba(0, 168, 112, 0.0)' },
          ]),
        },
        data: memoryData.values.map((v) => [v.timestamp * 1000, v.value]),
      },
    ],
  };

  chart.value.setOption(option);
};

// 时间范围切换
const handleRangeChange = () => {
  fetchMetricsHistory();
};

// 初始化图表
const initChart = () => {
  if (!chartContainer.value) return;

  chart.value = echarts.init(chartContainer.value);

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize);
  fetchMetricsHistory();

  // 定时刷新 (30秒)
  refreshInterval.value = window.setInterval(() => {
    fetchMetricsHistory();
  }, 30000);
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
  height: 350px;
}
</style>
