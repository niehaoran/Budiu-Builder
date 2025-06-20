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
  const nonSensitiveFields = ['repoUrl', 'branch', 'imageName', 'imageTag', 'registry', 'apiEndpoint', 'callbackUrl', 'dockerUsername'];
  const sensitiveFields = ['dockerPassword', 'repoToken', 'githubToken'];

  // GitHub Actions相关配置
  const GITHUB_API_ENDPOINT = 'https://api.github.com/repos';
  const DEFAULT_REPO = 'your-username/Budiu-Builder'; // 更改为您的仓库
  const ACTIONS_WORKFLOW = 'build.yml';

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

    // 获取表单输入值
    const formData = getFormData();

    // 验证必填字段
    if (!validateFormData(formData)) return;

    // 保存非敏感信息（如果用户选择了记住）
    if (rememberCheckbox.checked) {
      saveFormData(formData);
    } else {
      clearSavedFormData();
    }

    // 显示加载状态
    statusCard.classList.remove('hidden');
    statusOutput.className = 'status pending';
    statusOutput.textContent = '正在提交构建请求...';
    buildDetails.classList.add('hidden');

    // 确定是使用API端点还是直接调用GitHub Actions
    if (formData.apiEndpoint) {
      // 使用API端点
      submitThroughBackend(formData);
    } else {
      // 直接调用GitHub Actions
      submitDirectlyToGitHubActions(formData);
    }
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
      repoUrl: document.getElementById('repoUrl').value.trim(),
      branch: document.getElementById('branch').value.trim() || 'main',
      repoToken: document.getElementById('repoToken').value.trim(),
      imageName: document.getElementById('imageName').value.trim(),
      imageTag: document.getElementById('imageTag').value.trim() || 'latest',
      registry: document.getElementById('registry').value.trim() || 'docker.io',
      dockerUsername: document.getElementById('dockerUsername').value.trim(),
      dockerPassword: document.getElementById('dockerPassword').value.trim(),
      apiEndpoint: document.getElementById('apiEndpoint').value.trim(),
      githubToken: document.getElementById('githubToken').value.trim(),
      callbackUrl: document.getElementById('callbackUrl').value.trim()
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

    // 如果未设置API端点但也未提供GitHub令牌
    if (!data.apiEndpoint && !data.githubToken) {
      alert('请提供API端点或GitHub令牌，以便触发构建');
      return false;
    }

    return true;
  }

  // 通过后端API提交
  function submitThroughBackend(data) {
    // 准备请求数据 (不包含敏感信息)
    const requestData = {
      repo_url: data.repoUrl,
      branch: data.branch,
      image_name: data.imageName,
      image_tag: data.imageTag,
      registry: data.registry,
      docker_username: data.dockerUsername,
      docker_password: data.dockerPassword
    };

    // 可选参数
    if (data.repoToken) requestData.repo_token = data.repoToken;
    if (data.callbackUrl) requestData.callback_url = data.callbackUrl;

    // 发送构建请求
    fetch(`${data.apiEndpoint}/build`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    })
      .then(handleResponse)
      .then(data => {
        handleSuccessResponse(data, data.apiEndpoint);
      })
      .catch(handleError);
  }

  // 直接调用GitHub Actions
  function submitDirectlyToGitHubActions(data) {
    // GitHub Actions工作流触发请求体
    const actionRequestData = {
      ref: 'main', // 工作流所在分支
      inputs: {
        repo_url: data.repoUrl,
        branch: data.branch,
        image_name: data.imageName,
        image_tag: data.imageTag,
        registry: data.registry,
        docker_username: data.dockerUsername,
        docker_password: data.dockerPassword
      }
    };

    // 添加可选参数
    if (data.repoToken) actionRequestData.inputs.repo_token = data.repoToken;
    if (data.callbackUrl) actionRequestData.inputs.callback_url = data.callbackUrl;

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
        // GitHub Actions API 成功触发不返回内容
        if (response.status === 204) {
          // 生成一个临时ID
          const tempId = `gh-${Date.now()}`;
          handleSuccessResponse({
            build_id: tempId,
            status: 'pending',
            message: 'GitHub Action已触发',
            direct_github_action: true
          }, null);
        } else {
          throw new Error(`GitHub API响应错误: ${response.status}`);
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

  // 处理成功响应
  function handleSuccessResponse(data, apiEndpoint) {
    if (data.error) {
      // 显示错误
      statusOutput.className = 'status error';
      statusOutput.textContent = `错误: ${data.error}`;
    } else {
      // 显示成功
      statusOutput.className = 'status success';
      statusOutput.textContent = `构建请求已提交! 构建ID: ${data.build_id}`;

      // 显示构建详情
      buildDetails.classList.remove('hidden');
      buildIdDisplay.textContent = data.build_id;
      buildStatusDisplay.textContent = getStatusText(data.status || 'pending');

      // 如果是直接调用GitHub Actions，不尝试获取状态
      if (!data.direct_github_action && apiEndpoint) {
        // 保存构建ID并获取状态
        fetchBuildStatus(data.build_id, apiEndpoint);
      } else {
        createdAtDisplay.textContent = new Date().toLocaleString('zh-CN');
        updatedAtDisplay.textContent = new Date().toLocaleString('zh-CN');
        statusOutput.textContent = '已通过GitHub Actions触发构建。请前往GitHub仓库Actions选项卡查看进度。';
      }
    }
  }

  // 处理错误
  function handleError(error) {
    statusOutput.className = 'status error';
    statusOutput.textContent = `请求失败: ${error.message}`;
    console.error(error);
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

  // 保存表单数据到localStorage
  function saveFormData(data) {
    if (!rememberCheckbox.checked) return;

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