<template>
  <div class="secret-form">
    <t-form
      ref="formRef"
      :data="formData"
      :rules="formRules"
      label-align="right"
      :label-width="120"
    >
      <!-- 基本信息 -->
      <t-form-item label="名称" name="name">
        <t-input
          v-model="formData.name"
          placeholder="请输入 Secret 名称"
          :maxlength="253"
        />
      </t-form-item>

      <t-form-item label="类型" name="type">
        <t-select v-model="formData.type" style="width: 300px">
          <t-option value="Opaque" label="Opaque (通用密钥)" />
          <t-option value="kubernetes.io/dockerconfigjson" label="docker-registry (镜像仓库认证)" />
          <t-option value="kubernetes.io/tls" label="TLS (证书)" />
          <t-option value="kubernetes.io/basic-auth" label="basic-auth (基本认证)" />
        </t-select>
      </t-form-item>

      <!-- Opaque 类型数据 -->
      <template v-if="formData.type === 'Opaque'">
        <t-form-item label="数据项">
          <div class="data-editor">
            <div v-for="(item, index) in formData.data" :key="index" class="data-row">
              <t-input v-model="item.key" placeholder="键" style="width: 150px" />
              <t-input
                v-model="item.value"
                :type="item.showValue ? 'text' : 'password'"
                placeholder="值"
                style="flex: 1"
              >
                <template #suffix>
                  <t-button
                    variant="text"
                    size="small"
                    @click="item.showValue = !item.showValue"
                  >
                    {{ item.showValue ? '隐藏' : '显示' }}
                  </t-button>
                </template>
              </t-input>
              <t-button
                theme="danger"
                variant="text"
                size="small"
                @click="removeData(index)"
              >
                <template #icon><delete-icon /></template>
              </t-button>
            </div>
            <t-button variant="outline" size="small" @click="addData">
              <template #icon><add-icon /></template>
              添加数据项
            </t-button>
          </div>
        </t-form-item>
      </template>

      <!-- Docker Registry 类型 -->
      <template v-if="formData.type === 'kubernetes.io/dockerconfigjson'">
        <t-form-item label="Registry 地址">
          <t-input v-model="formData.dockerRegistry.server" placeholder="例如: docker.io" />
        </t-form-item>
        <t-form-item label="用户名">
          <t-input v-model="formData.dockerRegistry.username" placeholder="用户名" />
        </t-form-item>
        <t-form-item label="密码">
          <t-input v-model="formData.dockerRegistry.password" type="password" placeholder="密码" />
        </t-form-item>
        <t-form-item label="邮箱">
          <t-input v-model="formData.dockerRegistry.email" placeholder="邮箱（可选）" />
        </t-form-item>
      </template>

      <!-- TLS 类型 -->
      <template v-if="formData.type === 'kubernetes.io/tls'">
        <t-form-item label="证书 (tls.crt)">
          <t-textarea
            v-model="formData.tls.cert"
            :autosize="{ minRows: 3, maxRows: 8 }"
            placeholder="-----BEGIN CERTIFICATE-----"
          />
        </t-form-item>
        <t-form-item label="私钥 (tls.key)">
          <t-textarea
            v-model="formData.tls.key"
            :autosize="{ minRows: 3, maxRows: 8 }"
            placeholder="-----BEGIN RSA PRIVATE KEY-----"
          />
        </t-form-item>
      </template>

      <!-- Basic Auth 类型 -->
      <template v-if="formData.type === 'kubernetes.io/basic-auth'">
        <t-form-item label="用户名">
          <t-input v-model="formData.basicAuth.username" placeholder="用户名" />
        </t-form-item>
        <t-form-item label="密码">
          <t-input v-model="formData.basicAuth.password" type="password" placeholder="密码" />
        </t-form-item>
      </template>

      <!-- YAML 预览 -->
      <t-form-item label="YAML 预览">
        <pre class="yaml-preview">{{ generatedYaml }}</pre>
      </t-form-item>
    </t-form>

    <!-- 底部操作 -->
    <div class="form-footer">
      <t-button theme="default" @click="handleCancel">取消</t-button>
      <t-button theme="success" @click="handleSubmit" :loading="submitting">
        {{ mode === 'create' ? '创建 Secret' : '更新 Secret' }}
      </t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import * as yaml from 'js-yaml';
import { MessagePlugin } from 'tdesign-vue-next';
import { DeleteIcon, AddIcon } from 'tdesign-icons-vue-next';
import { createSecret, type Secret } from '@/api/k8s-resources';
import { useClusterResourceStore } from '@/store/modules/cluster-resource';

interface Props {
  mode?: 'create' | 'edit';
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
});

const emit = defineEmits<{
  (e: 'success'): void;
  (e: 'cancel'): void;
}>();

const store = useClusterResourceStore();
const clusterId = computed(() => store.clusterId);
const namespace = computed(() => store.namespace);

const formRef = ref();
const submitting = ref(false);

const formData = ref({
  name: '',
  type: 'Opaque',
  data: [{ key: '', value: '', showValue: false }],
  dockerRegistry: {
    server: '',
    username: '',
    password: '',
    email: '',
  },
  tls: {
    cert: '',
    key: '',
  },
  basicAuth: {
    username: '',
    password: '',
  },
});

const formRules = {
  name: [
    { required: true, message: '请输入 Secret 名称', trigger: 'blur' as const },
  ],
};

// Base64 编码
function base64Encode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

// 生成 YAML
const generatedYaml = computed(() => {
  const secret: any = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {
      name: formData.value.name || 'my-secret',
      namespace: namespace.value,
    },
    type: formData.value.type,
  };

  if (formData.value.type === 'Opaque') {
    const data = Object.fromEntries(
      formData.value.data
        .filter(d => d.key)
        .map(d => [d.key, base64Encode(d.value)])
    );
    if (Object.keys(data).length > 0) {
      secret.data = data;
    }
  } else if (formData.value.type === 'kubernetes.io/dockerconfigjson') {
    const dockerConfig = {
      auths: {
        [formData.value.dockerRegistry.server || 'docker.io']: {
          username: formData.value.dockerRegistry.username,
          password: formData.value.dockerRegistry.password,
          email: formData.value.dockerRegistry.email,
          auth: base64Encode(
            `${formData.value.dockerRegistry.username}:${formData.value.dockerRegistry.password}`
          ),
        },
      },
    };
    secret.data = {
      '.dockerconfigjson': base64Encode(JSON.stringify(dockerConfig)),
    };
  } else if (formData.value.type === 'kubernetes.io/tls') {
    secret.data = {
      'tls.crt': base64Encode(formData.value.tls.cert),
      'tls.key': base64Encode(formData.value.tls.key),
    };
  } else if (formData.value.type === 'kubernetes.io/basic-auth') {
    secret.data = {
      username: base64Encode(formData.value.basicAuth.username),
      password: base64Encode(formData.value.basicAuth.password),
    };
  }

  return yaml.dump(secret, { indent: 2, noRefs: true });
});

function addData() {
  formData.value.data.push({ key: '', value: '', showValue: false });
}

function removeData(index: number) {
  formData.value.data.splice(index, 1);
}

async function handleSubmit() {
  const valid = await formRef.value?.validate();
  if (valid !== true) return;

  submitting.value = true;
  try {
    const secretData = yaml.load(generatedYaml.value) as Secret;
    await createSecret(clusterId.value, namespace.value, secretData);
    MessagePlugin.success('Secret 创建成功');
    emit('success');
  } catch (e: any) {
    MessagePlugin.error(e.message || '创建失败');
  } finally {
    submitting.value = false;
  }
}

function handleCancel() {
  emit('cancel');
}
</script>

<style lang="less" scoped>
.secret-form {
  .data-editor {
    width: 100%;

    .data-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
  }

  .yaml-preview {
    width: 100%;
    max-height: 200px;
    overflow: auto;
    padding: 12px;
    background: var(--td-bg-color-page);
    border: 1px solid var(--td-border-level-1-color);
    border-radius: var(--td-radius-default);
    font-family: monospace;
    font-size: 12px;
    margin: 0;
  }

  .form-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--td-border-level-1-color);
  }
}
</style>
