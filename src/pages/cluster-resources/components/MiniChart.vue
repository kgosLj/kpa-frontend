<template>
  <div class="mini-chart">
    <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`">
      <!-- 背景网格线（可选） -->
      <line
        v-for="i in 3"
        :key="`grid-${i}`"
        :x1="0"
        :y1="(height / 4) * i"
        :x2="width"
        :y2="(height / 4) * i"
        stroke="#e7e7e7"
        stroke-width="0.5"
        opacity="0.5"
      />
      
      <!-- 曲线 -->
      <polyline
        :points="points"
        fill="none"
        :stroke="color"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      
      <!-- 填充区域 -->
      <polygon
        :points="fillPoints"
        :fill="color"
        opacity="0.1"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

const props = withDefaults(defineProps<Props>(), {
  width: 80,
  height: 30,
  color: '#0052d9',
});

// 计算曲线的点坐标
const points = computed(() => {
  if (!props.data || props.data.length === 0) {
    return '';
  }

  const maxValue = Math.max(...props.data, 1); // 避免除以0
  const minValue = Math.min(...props.data, 0);
  const range = maxValue - minValue || 1;
  
  const stepX = props.width / (props.data.length - 1 || 1);
  const padding = 2; // 上下留一点边距
  
  return props.data
    .map((value, index) => {
      const x = index * stepX;
      // 将值映射到 height 范围内（反转 y 轴，因为 SVG 的 y 轴向下）
      const normalizedValue = (value - minValue) / range;
      const y = props.height - padding - (normalizedValue * (props.height - 2 * padding));
      return `${x},${y}`;
    })
    .join(' ');
});

// 计算填充区域的点坐标（曲线 + 底部边界）
const fillPoints = computed(() => {
  if (!points.value) {
    return '';
  }
  
  // 添加右下角和左下角的点，形成闭合区域
  const rightBottom = `${props.width},${props.height}`;
  const leftBottom = `0,${props.height}`;
  
  return `${points.value} ${rightBottom} ${leftBottom}`;
});
</script>

<style lang="less" scoped>
.mini-chart {
  display: inline-block;
  
  svg {
    display: block;
  }
}
</style>
