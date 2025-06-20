document.addEventListener('DOMContentLoaded', function () {
  const buildForm = document.getElementById('buildForm');
  const statusCard = document.getElementById('statusCard');
  const statusOutput = document.getElementById('statusOutput');
  const buildDetails = document.getElementById('buildDetails');
  const buildIdDisplay = document.getElementById('buildId');
  const buildStatusDisplay = document.getElementById('buildStatus');
  const createdAtDisplay = document.getElementById('createdAt');
  const updatedAtDisplay = document.getElementById('updatedAt');
  const imageRow = document.getElementById('imageRow');
  const imageUrlDisplay = document.getElementById('imageUrl');
  const refreshStatusButton = document.getElementById('refreshStatus');
  const rememberCheckbox = document.getElementById('rememberNonSensitive');
  const apiEndpointInput = document.getElementById('apiEndpoint');

  // 非敏感字段列表
  const nonSensitiveFields = ['repoUrl', 'branch', 'imageName', 'imageTag', 'registry', 'callbackUrl', 'dockerUsername'];
  const sensitiveFields = ['dockerPassword', 'repoToken', 'githubToken'];

  // GitHub Actions相关配置
  const GITHUB_API_ENDPOINT = 'https://api.github.com/repos';
  const DEFAULT_REPO = 'your-username/Budiu-Builder'; // 更改为您的仓库
  const ACTIONS_WORKFLOW = 'build.yml';

  // 显示当前仓库配置
  console.log('当前配置的Actions仓库:', DEFAULT_REPO);

  // 检查是否需要配置仓库
  if (DEFAULT_REPO === 'your-username/Budiu-Builder') {
    console.warn('警告: 您需要更新app.js中的DEFAULT_REPO变量为您自己的仓库名称!');

    // 显示警告信息在页面上
    const warningDiv = document.createElement('div');
    warningDiv.className = 'card warning';
    warningDiv.innerHTML = `
      <h3>⚠️ 配置警告</h3>
      <p>您需要更新代码中的仓库信息才能使用此应用!</p>
      <p>请修改 <code>docs/app.js</code> 文件中的 <code>DEFAULT_REPO</code> 变量为您自己的仓库路径。</p>
      <p>格式: <code>'username/repository-name'</code></p>
    `;
    document.querySelector('main').insertBefore(warningDiv, buildForm.parentNode);
  }

  // 检查localStorage中是否有保存的API端点
  if (localStorage.getItem('apiEndpoint')) {
    apiEndpointInput.value = localStorage.getItem('apiEndpoint');
  }

  let currentBuildId = null;

  // 恢复保存的非敏感表单数据
  loadSavedFormData();

  // 表单提交处理
  buildForm.addEventListener('submit', function (e) {
    e.preventDefault();

    // 检查仓库配置
    if (DEFAULT_REPO === 'your-username/Budiu-Builder') {
      alert('请先在app.js中配置您的GitHub仓库信息!');
      return;
    }

    // 获取表单输入值
    const formData = getFormData();

    // 验证必填字段
    if (!validateFormData(formData)) return;

    // 保存非敏感信息（如果用户选择了记住）
    if (rememberCheckbox && rememberCheckbox.checked) {
      saveFormData(formData);
    } else {
      clearSavedFormData();
    }

    // 显示加载状态
    statusCard.classList.remove('hidden');
    statusOutput.className = 'status pending';
    statusOutput.textContent = '正在提交构建请求...';
    buildDetails.classList.add('hidden');

    // 调用GitHub Actions
    submitToGitHubActions(formData);
  });

  // 刷新状态按钮
  refreshStatusButton.addEventListener('click', function () {
    const apiEndpoint = document.getElementById('apiEndpoint').value.trim();
    const buildId = buildIdDisplay.textContent;

    if (buildId) {
      fetchBuildStatus(buildId, apiEndpoint);
    }
  });

  // 获取表单数据
  function getFormData() {
    return {
      repoUrl: document.getElementById('repoUrl') ? document.getElementById('repoUrl').value.trim() : '',
      branch: document.getElementById('branch') ? document.getElementById('branch').value.trim() : 'main',
      repoToken: document.getElementById('repoToken') ? document.getElementById('repoToken').value.trim() : '',
      imageName: document.getElementById('imageName') ? document.getElementById('imageName').value.trim() : '',
      imageTag: document.getElementById('imageTag') ? document.getElementById('imageTag').value.trim() : 'latest',
      registry: document.getElementById('registry') ? document.getElementById('registry').value.trim() : 'docker.io',
      dockerUsername: document.getElementById('dockerUsername') ? document.getElementById('dockerUsername').value.trim() : '',
      dockerPassword: document.getElementById('dockerPassword') ? document.getElementById('dockerPassword').value.trim() : '',
      githubToken: document.getElementById('githubToken') ? document.getElementById('githubToken').value.trim() : '',
      callbackUrl: document.getElementById('callbackUrl') ? document.getElementById('callbackUrl').value.trim() : ''
    };
  }

  // 验证表单数据
  function validateFormData(data) {
    if (!data.repoUrl) {
      alert('请输入代码仓库URL');
      return false;
    }

    if (!data.imageName) {
      alert('请输入镜像名称');
      return false;
    }

    if (!data.dockerUsername) {
      alert('请输入Docker用户名');
      return false;
    }

    if (!data.dockerPassword) {
      alert('请输入Docker密码/令牌');
      return false;
    }

    if (!data.githubToken) {
      alert('请提供GitHub令牌，以便触发构建');
      return false;
    }

    return true;
  }

  // 调用GitHub Actions
  function submitToGitHubActions(data) {
    console.log('开始触发GitHub Actions...');
    console.log('目标仓库:', DEFAULT_REPO);

    // GitHub Actions工作流触发请求体
    const actionRequestData = {
      ref: 'main', // 工作流所在分支
      inputs: {
        repo_url: data.repoUrl,
        branch: data.branch || 'main',
        image_name: data.imageName,
        image_tag: data.imageTag || 'latest',
        registry: data.registry || 'docker.io',
        docker_username: data.dockerUsername,
        docker_password: data.dockerPassword
      }
    };

    // 添加可选参数
    if (data.repoToken) actionRequestData.inputs.repo_token = data.repoToken;
    if (data.callbackUrl) actionRequestData.inputs.callback_url = data.callbackUrl;

    console.log('请求数据:', JSON.stringify(actionRequestData, null, 2));

    // 触发GitHub Action
    fetch(`${GITHUB_API_ENDPOINT}/${DEFAULT_REPO}/actions/workflows/${ACTIONS_WORKFLOW}/dispatches`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${data.githubToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(actionRequestData)
    })
      .then(response => {
        console.log('GitHub API响应状态:', response.status);

        // GitHub Actions API 成功触发不返回内容
        if (response.status === 204) {
          // 生成一个临时ID
          const tempId = `gh-${Date.now()}`;

          // 显示成功信息
          statusOutput.className = 'status success';
          statusOutput.textContent = '成功触发GitHub Actions构建!';

          // 显示构建详情
          buildDetails.classList.remove('hidden');
          buildIdDisplay.textContent = tempId;
          buildStatusDisplay.textContent = '进行中';
          createdAtDisplay.textContent = new Date().toLocaleString('zh-CN');
          updatedAtDisplay.textContent = new Date().toLocaleString('zh-CN');

          // 显示指导信息
          statusOutput.innerHTML += '<br><br>您可以前往GitHub查看构建进度: ' +
            `<a href="https://github.com/${DEFAULT_REPO}/actions" target="_blank">查看Actions</a>`;
        } else {
          return response.text().then(text => {
            console.error('GitHub API错误响应:', text);
            throw new Error(`GitHub API响应错误: ${response.status} - ${text}`);
          });
        }
      })
      .catch(error => {
        console.error('请求失败:', error);
        statusOutput.className = 'status error';
        statusOutput.textContent = `请求失败: ${error.message}`;
      });
  }

  // 获取构建状态
  function fetchBuildStatus(buildId, apiEndpoint) {
    if (!apiEndpoint) return; // 没有API端点无法获取状态

    statusOutput.className = 'status pending';
    statusOutput.textContent = '正在获取构建状态...';

    fetch(`${apiEndpoint}/build/${buildId}`)
      .then(handleResponse)
      .then(data => {
        buildIdDisplay.textContent = data.build_id;
        buildStatusDisplay.textContent = getStatusText(data.status);

        if (data.created_at) {
          createdAtDisplay.textContent = formatDate(data.created_at);
        }

        if (data.updated_at) {
          updatedAtDisplay.textContent = formatDate(data.updated_at);
        }

        // 根据状态更新界面
        if (data.status === 'success') {
          statusOutput.className = 'status success';
          statusOutput.textContent = '构建成功!';

          if (data.image) {
            imageRow.classList.remove('hidden');
            imageUrlDisplay.textContent = data.image;
          }
        } else if (data.status === 'failed') {
          statusOutput.className = 'status error';
          statusOutput.textContent = '构建失败!';
        } else {
          statusOutput.className = 'status pending';
          statusOutput.textContent = '构建进行中...';

          // 每10秒自动刷新一次
          setTimeout(() => fetchBuildStatus(buildId, apiEndpoint), 10000);
        }
      })
      .catch(handleError);
  }

  // 处理API响应
  function handleResponse(response) {
    if (!response.ok) {
      throw new Error(`请求失败，状态码: ${response.status}`);
    }
    return response.json();
  }

  // 处理错误
  function handleError(error) {
    statusOutput.className = 'status error';
    statusOutput.textContent = `请求失败: ${error.message}`;
    console.error(error);
  }

  // 保存表单数据到localStorage
  function saveFormData(data) {
    if (!rememberCheckbox || !rememberCheckbox.checked) return;

    // 只保存非敏感字段
    nonSensitiveFields.forEach(field => {
      if (data[field]) {
        localStorage.setItem(`budiu_${field}`, data[field]);
      }
    });
  }

  // 从localStorage加载保存的表单数据
  function loadSavedFormData() {
    nonSensitiveFields.forEach(field => {
      const value = localStorage.getItem(`budiu_${field}`);
      if (value) {
        const inputEl = document.getElementById(field);
        if (inputEl) {
          inputEl.value = value;
        }
      }
    });
  }

  // 清除保存的表单数据
  function clearSavedFormData() {
    nonSensitiveFields.forEach(field => {
      localStorage.removeItem(`budiu_${field}`);
    });
  }

  // 辅助函数
  function getStatusText(status) {
    switch (status) {
      case 'pending': return '进行中';
      case 'success': return '成功';
      case 'failed': return '失败';
      default: return status;
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString('zh-CN');
    } catch (e) {
      return dateStr;
    }
  }
}); 