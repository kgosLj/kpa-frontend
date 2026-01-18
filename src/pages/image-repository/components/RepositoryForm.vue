<template>
  <t-dialog
    v-model:visible="dialogVisible"
    :header="isEdit ? '编辑镜像仓库' : '新增镜像仓库'"
    :confirm-btn="{ content: '提交', loading: submitLoading }"
    @confirm="handleSubmit"
    @close="handleClose"
    width="700px"
  >
    <t-form
      ref="formRef"
      :data="formData"
      :rules="formRules"
      label-align="right"
      :label-width="120"
    >
      <t-form-item label="仓库名称" name="name">
        <t-input v-model="formData.name" placeholder="请输入仓库名称" />
      </t-form-item>

      <t-form-item label="仓库类型" name="type">
        <t-radio-group v-model="formData.type" :disabled="isEdit">
          <t-radio-button value="harbor">Harbor</t-radio-button>
          <t-radio-button value="tencent">腾讯云 TCR</t-radio-button>
        </t-radio-group>
      </t-form-item>

      <!-- Harbor 需要手动输入端点地址 -->
      <t-form-item
        v-if="formData.type === 'harbor'"
        label="端点地址"
        name="endpoint"
      >
        <t-input
          v-model="formData.endpoint"
          placeholder="例如: https://harbor.example.com"
        />
      </t-form-item>

      <!-- 腾讯云 TCR 显示镜像拉取地址（可编辑） -->
      <t-form-item
        v-if="formData.type === 'tencent'"
        label="镜像地址"
        name="endpoint"
      >
        <t-input
          v-model="formData.endpoint"
          placeholder="例如: ccr.ccs.tencentyun.com"
        />
        <template #tips>
          <div style="font-size: 12px; color: #999; margin-top: 4px; line-height: 1.6;">
            <div>腾讯云镜像拉取地址格式：</div>
            <div style="margin: 4px 0;">
              • <b>个人版 CCR</b>：<code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">ccr.ccs.tencentyun.com</code>
            </div>
            <div>
              • <b>企业版 TCR</b>：<code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">[InstanceId].tcr.[region].tencentcloudapi.com</code><br/>
              例如：<code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">tcr-abc123.tcr.ap-guangzhou.tencentcloudapi.com</code>
            </div>
          </div>
        </template>
      </t-form-item>

      <t-form-item
        :label="formData.type === 'tencent' ? 'SecretId' : '用户名'"
        name="username"
      >
        <t-input
          v-model="formData.username"
          :placeholder="formData.type === 'tencent' ? '腾讯云 SecretId (以 AKID 开头)' : '请输入用户名'"
        />
      </t-form-item>

      <!-- Harbor 需要密码，腾讯云不需要 -->
      <t-form-item v-if="formData.type === 'harbor'" label="密码" name="password">
        <t-input
          v-model="formData.password"
          type="password"
          placeholder="请输入 Harbor 密码"
        />
      </t-form-item>

      <!-- 腾讯云特有字段 -->
      <template v-if="formData.type === 'tencent'">
        <t-form-item label="TCR实例ID" name="registry_id">
          <t-input
            v-model="formData.registry_id"
            placeholder="企业版填写实例ID，个人版留空"
          />
          <template #tips>
            <div style="font-size: 12px; color: #999; margin-top: 4px; line-height: 1.6;">
              <div><b>企业版 TCR</b>: 填写实例ID (例如: tcr-abc123xx)</div>
              <div><b>个人版 CCR</b>: 留空即可</div>
              <div style="margin-top: 4px;">获取方式: 腾讯云控制台 → 容器镜像服务 → 实例列表</div>
            </div>
          </template>
        </t-form-item>

        <t-form-item label="区域" name="region">
          <t-input
            v-model="formData.region"
            placeholder="例如: ap-guangzhou (广州), ap-shanghai (上海)"
          />
        </t-form-item>

        <t-form-item label="SecretKey" name="secret_key">
          <t-input
            v-model="formData.secret_key"
            type="password"
            placeholder="腾讯云访问密钥 (Secret Key)"
          />
        </t-form-item>

        <t-alert theme="info" message="腾讯云密钥获取方式：登录腾讯云控制台 → 访问管理 → API密钥管理" />
      </template>

      <t-form-item label="所属项目" name="project_id">
        <t-select
          v-model="formData.project_id"
          placeholder="请选择项目"
          :disabled="isEdit"
          :loading="projectsLoading"
        >
          <t-option
            v-for="project in projects"
            :key="project.id"
            :value="project.id"
            :label="project.name"
          />
        </t-select>
        <template v-if="projects.length === 0 && !projectsLoading" #tips>
          <div style="color: #f5222d; font-size: 12px; margin-top: 4px;">
            获取项目列表失败，请检查后端服务是否正常运行
          </div>
        </template>
      </t-form-item>

      <t-alert theme="info" message="认证信息将加密存储,请妥善保管" />
    </t-form>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import type { FormInstanceFunctions, FormRule } from 'tdesign-vue-next';
import { createRepository, updateRepository } from '@/api/image-repository';
import { getProjectList } from '@/api/project';
import type { ImageRepository, CreateRepositoryForm } from '@/types/repository';

interface Props {
  visible: boolean;
  repository?: ImageRepository | null;
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const formRef = ref<FormInstanceFunctions>();
const submitLoading = ref(false);
const projects = ref<any[]>([]);
const projectsLoading = ref(false);

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const isEdit = computed(() => !!props.repository);

const formData = ref<CreateRepositoryForm>({
  name: '',
  type: 'harbor',
  endpoint: '',
  username: '',
  password: '',
  secret_key: '',
  region: '',
  registry_id: '', // TCR 实例 ID
  project_id: '',
});

const formRules: Record<string, FormRule[]> = {
  name: [{ required: true, message: '请输入仓库名称', type: 'error' }],
  type: [{ required: true, message: '请选择仓库类型', type: 'error' }],
  endpoint: [
    { required: true, message: '请输入端点地址', type: 'error' },
    { url: true, message: '请输入有效的URL', type: 'warning' },
  ],
  username: [
    {
      required: true,
      message: (formData.value.type === 'tencent' ? '请输入腾讯云 SecretId' : '请输入用户名'),
      type: 'error',
    }
  ],
  password: [
    {
      required: false,
      validator: (val: string) => {
        // Harbor 类型需要密码
        if (formData.value.type === 'harbor' && !val) {
          return false;
        }
        return true;
      },
      message: '请输入 Harbor 密码'
    }
  ],
  secret_key: [
    {
      required: true,
      message: '请输入腾讯云 SecretKey',
      type: 'error',
      validator: (val: string) => {
        // 只在腾讯云类型时验证
        if (formData.value.type === 'tencent' && !val) {
          return false;
        }
        return true;
      }
    }
  ],
  project_id: [{ required: true, message: '请选择项目', type: 'error' }],
};

// 获取项目列表
const fetchProjects = async () => {
  projectsLoading.value = true;
  try {
    const res = await getProjectList();
    projects.value = res;
  } catch (error: any) {
    console.error('Failed to load projects:', error);
    MessagePlugin.warning('获取项目列表失败，请确保后端服务正常运行');
    projects.value = []; // 清空列表
  } finally {
    projectsLoading.value = false;
  }
};

// 提交表单
const handleSubmit = async () => {
  const valid = await formRef.value?.validate();
  if (!valid) return;

  submitLoading.value = true;
  try {
    if (isEdit.value && props.repository) {
      // 编辑模式：只发送修改的字段
      const updateData: any = {};
      if (formData.value.name !== props.repository.name) {
        updateData.name = formData.value.name;
      }
      if (formData.value.endpoint !== props.repository.endpoint) {
        updateData.endpoint = formData.value.endpoint;
      }
      if (formData.value.username) {
        updateData.username = formData.value.username;
      }
      if (formData.value.password) {
        updateData.password = formData.value.password;
      }
      if (formData.value.region) {
        updateData.region = formData.value.region;
      }
      if (formData.value.secret_key) {
        updateData.secret_key = formData.value.secret_key;
      }

      await updateRepository(props.repository.id, updateData);
      MessagePlugin.success('更新成功');
    } else {
      // 新增模式
      await createRepository(formData.value);
      MessagePlugin.success('创建成功');
    }

    dialogVisible.value = false;
    emit('success');
  } catch (error: any) {
    MessagePlugin.error(error.message || '操作失败');
  } finally {
    submitLoading.value = false;
  }
};

// 关闭对话框
const handleClose = () => {
  formRef.value?.reset();
  formData.value = {
    name: '',
    type: 'harbor',
    endpoint: '',
    username: '',
    password: '',
    secret_key: '',
    region: '',
    registry_id: '', // TCR 实例 ID
    project_id: '',
  };
};

// 监听对话框打开
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      fetchProjects();
      if (props.repository) {
        // 编辑模式：回填数据
        formData.value = {
          name: props.repository.name,
          type: props.repository.type,
          endpoint: props.repository.endpoint,
          username: '',
          password: '',
          secret_key: '',
          region: props.repository.region || '',
          registry_id: props.repository.registry_id || '', // TCR 实例 ID
          project_id: props.repository.project_id,
        };
      }
    }
  },
);
</script>

<style lang="less" scoped>
:deep(.t-form__controls) {
  width: 100%;
}

:deep(.t-alert) {
  margin-top: 16px;
}
</style>
