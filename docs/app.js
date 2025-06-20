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
  const repoUrlInput = document.getElementById('repoUrl');
  const branchInput = document.getElementById('branch');

  // 非敏感字段列表
  const nonSensitiveFields = ['repoUrl', 'branch', 'imageName', 'imageTag', 'registry', 'callbackUrl', 'dockerUsername'];

  // GitHub Actions相关配置
  const GITHUB_API_ENDPOINT = 'https://api.github.com/repos';
  const DEFAULT_REPO = 'niehaoran/Budiu-Builder'; // 已更新为实际仓库
  const ACTIONS_WORKFLOW = 'build.yml';

  // 显示当前仓库配置
  console.log('当前配置的Actions仓库:', DEFAULT_REPO);

  // 为仓库URL输入框添加变化监听器，自动提取分支名称
  if (repoUrlInput) {
    repoUrlInput.addEventListener('blur', function () {
      const url = repoUrlInput.value.trim();
      if (url && branchInput) {
        const extractedBranch = extractBranchFromUrl(url);
        if (extractedBranch) {
          branchInput.value = extractedBranch;
          console.log('从URL自动检测到分支:', extractedBranch);
        }
      }
    });
  }

  // 从仓库URL中提取分支名
  function extractBranchFromUrl(url) {
    if (!url) return null;

    // 检查URL是否包含分支信息
    // 格式可能是：https://github.com/user/repo/tree/branch 或 /user/repo/tree/branch
    const branchPatterns = [
      /github\.com\/[^\/]+\/[^\/]+\/tree\/([^\/]+)/,  // GitHub /tree/branch 格式
      /github\.com\/[^\/]+\/[^\/]+\/blob\/([^\/]+)/,  // GitHub /blob/branch 格式
      /gitee\.com\/[^\/]+\/[^\/]+\/tree\/([^\/]+)/,   // Gitee /tree/branch 格式
      /gitee\.com\/[^\/]+\/[^\/]+\/blob\/([^\/]+)/    // Gitee /blob/branch 格式
    ];

    for (const pattern of branchPatterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1]; // 返回匹配到的分支名
      }
    }

    return null; // 没有找到分支名，保留表单默认值
  }

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
    const buildId = buildIdDisplay.textContent;

    if (buildId) {
      alert('此版本不支持通过API刷新状态。请前往GitHub Actions页面查看最新状态。');
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
}); 