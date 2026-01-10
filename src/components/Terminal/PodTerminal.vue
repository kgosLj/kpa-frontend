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
    rows: 30,
    cols: 120,
  });

  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(new WebLinksAddon());

  term.open(terminalRef.value);
  fitAddon.fit();

  // 发送用户输入到 WebSocket
  term.onData((data) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log('[Terminal] Sending input:', data.length, 'bytes');
      socket.send(data);
    } else {
      console.warn('[Terminal] WebSocket not ready, state:', socket?.readyState);
    }
  });

  // 监听终端大小变化
  term.onResize((size) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const resizeMsg = '4' + JSON.stringify({ cols: size.cols, rows: size.rows });
      console.log('[Terminal] Sending resize:', size);
      socket.send(resizeMsg);
    }
  });
  
  // Handle window resize
  window.addEventListener('resize', handleResize);
};

const handleResize = () => {
  if (fitAddon && term) {
    fitAddon.fit();
    console.log('[Terminal] Resized to:', term.cols, 'x', term.rows);
  }
};

const connectWebSocket = () => {
  if (socket) {
    console.log('[WebSocket] Closing existing connection');
    socket.close();
  }

  // Construct WebSocket URL
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  // 获取 token（从 Pinia store 的持久化存储中）
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
  // 后端地址：开发环境使用 localhost:8080，生产环境使用当前 host
  const backendHost = import.meta.env.DEV ? 'localhost:8080' : window.location.host;
  
  let wsUrl = `${protocol}//${backendHost}/api/v1/clusters/${props.clusterId}/pods/${props.namespace}/${props.podName}/exec`;
  
  // 添加查询参数
  const params = new URLSearchParams({
    container: props.container,
    command: '/bin/sh',
  });
  
  // 如果有 token，添加到参数中
  if (token) {
    params.append('token', token);
  }
  
  wsUrl += '?' + params.toString();
  
  console.log('[WebSocket] Connecting to:', wsUrl);
  
  // 创建 WebSocket 连接，设置二进制类型为 arraybuffer
  socket = new WebSocket(wsUrl);
  socket.binaryType = 'arraybuffer';

  socket.onopen = () => {
    console.log('[WebSocket] Connected successfully');
    term?.write('\r\n\x1b[32mConnected to terminal.\x1b[0m\r\n');
    
    // 连接成功后发送初始终端大小
    if (term) {
      const resizeMsg = '4' + JSON.stringify({ cols: term.cols, rows: term.rows });
      console.log('[WebSocket] Sending initial size:', term.cols, 'x', term.rows);
      socket?.send(resizeMsg);
    }
  };

  socket.onmessage = (event) => {
    try {
      let data: string;
      
      // 处理二进制消息
      if (event.data instanceof ArrayBuffer) {
        const decoder = new TextDecoder('utf-8');
        data = decoder.decode(event.data);
        console.log('[WebSocket] Binary message received:', data.length, 'bytes');
      } else if (typeof event.data === 'string') {
        data = event.data;
        console.log('[WebSocket] Text message received:', data.length, 'bytes');
      } else {
        console.warn('[WebSocket] Unknown message type:', typeof event.data);
        return;
      }
      
      // 写入终端
      if (data && term) {
        term.write(data);
      }
    } catch (error) {
      console.error('[WebSocket] Error processing message:', error);
    }
  };

  socket.onclose = (event) => {
    console.log('[WebSocket] Connection closed:', event.code, event.reason);
    term?.write(`\r\n\x1b[31mConnection closed (Code: ${event.code}).\x1b[0m\r\n`);
    if (event.reason) {
      term?.write(`\x1b[31mReason: ${event.reason}\x1b[0m\r\n`);
    }
  };

  socket.onerror = (error) => {
    console.error('[WebSocket] Error:', error);
    term?.write('\r\n\x1b[31mConnection error.\x1b[0m\r\n');
  };
};

watch(() => [props.clusterId, props.namespace, props.podName], () => {
   // Reconnect if props change
   console.log('[Terminal] Props changed, reconnecting...');
   connectWebSocket();
});

onMounted(() => {
  console.log('[Terminal] Component mounted');
  initTerminal();
  connectWebSocket();
});

onBeforeUnmount(() => {
  console.log('[Terminal] Component unmounting');
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
