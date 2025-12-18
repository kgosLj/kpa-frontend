<template>
  <div class="terminal-container" ref="terminalRef"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

const props = defineProps<{
  clusterId: string;
  namespace: string;
  podName: string;
  container: string;
}>();

const terminalRef = ref<HTMLElement | null>(null);
let term: Terminal | null = null;
let socket: WebSocket | null = null;
let fitAddon: FitAddon | null = null;

const initTerminal = () => {
  if (!terminalRef.value) return;

  term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: {
      background: '#1e1e1e',
    },
  });

  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(new WebLinksAddon());

  term.open(terminalRef.value);
  fitAddon.fit();

  term.onData((data) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(data);
    }
  });
  
  // Handle resize
  window.addEventListener('resize', handleResize);
};

const handleResize = () => {
  if (fitAddon) {
    fitAddon.fit();
  }
};

const connectWebSocket = () => {
  if (socket) {
    socket.close();
  }

  // Construct WebSocket URL
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  // 获取 token（从 Pinia store 的持久化存储中）
  // Pinia persist 插件将 token 存储在 localStorage 的 'user' 键下
  let token = '';
  try {
    const userStore = localStorage.getItem('user');
    if (userStore) {
      const userData = JSON.parse(userStore);
      token = userData.token || '';
    }
  } catch (e) {
    console.error('[WebSocket] Failed to parse user store:', e);
  }
  
  console.log('[WebSocket] Token:', token ? 'exists' : 'missing');
  console.log('[WebSocket] Cluster ID:', props.clusterId);
  console.log('[WebSocket] Namespace:', props.namespace);
  console.log('[WebSocket] Pod Name:', props.podName);
  console.log('[WebSocket] Container:', props.container);
  
  // 构建 WebSocket URL
  // 注意：直接连接到后端，不通过 Vite 代理
  // 后端地址：开发环境使用 localhost:8080，生产环境使用当前 host
  const backendHost = import.meta.env.DEV ? 'localhost:8080' : window.location.host;
  
  let wsUrl = `${protocol}//${backendHost}/api/v1/clusters/${props.clusterId}/pods/${props.namespace}/${props.podName}/exec`;
  
  // 添加查询参数
  const params = new URLSearchParams({
    container: props.container,
    command: '/bin/sh',
    stdin: 'true',
    stdout: 'true',
    stderr: 'true',
    tty: 'true',
  });
  
  // 如果有 token，添加到参数中
  if (token) {
    params.append('token', token);
  }
  
  wsUrl += '?' + params.toString();
  
  console.log('[WebSocket] Connecting to:', wsUrl);
  
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('[WebSocket] Connected successfully');
    term?.write('\r\n\x1b[32mConnected to terminal.\x1b[0m\r\n');
    handleResize();
  };

  socket.onmessage = (event) => {
    console.log('[WebSocket] Message received:', event.data.substring(0, 100));
    term?.write(event.data);
  };

  socket.onclose = (event) => {
    console.log('[WebSocket] Connection closed:', event.code, event.reason);
    term?.write(`\r\n\x1b[31mConnection closed (Code: ${event.code}).\x1b[0m\r\n`);
  };

  socket.onerror = (error) => {
    console.error('[WebSocket] Error:', error);
    term?.write('\r\n\x1b[31mConnection error.\x1b[0m\r\n');
  };
};

watch(() => [props.clusterId, props.namespace, props.podName], () => {
   // Reconnect if props change? Usually this component is mounted new.
});

onMounted(() => {
  initTerminal();
  connectWebSocket();
});

onBeforeUnmount(() => {
  if (socket) {
    socket.close();
  }
  if (term) {
    term.dispose();
  }
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.terminal-container {
  width: 100%;
  height: 500px;
  background-color: #1e1e1e;
  padding: 8px;
  border-radius: 4px;
  overflow: hidden;
}
</style>
