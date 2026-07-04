const Browser = (() => {
  const breadcrumbEl = document.getElementById('breadcrumb');
  const fileListEl = document.getElementById('file-list');
  const itemCountEl = document.getElementById('item-count');
  const btnBack = document.getElementById('btn-back');

  let breadcrumb = [];
  let currentPath = null;
  let currentItems = [];
  let renderToken = 0;

  function formatSize(bytes) {
    if (bytes == null || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
  }

  function getIcon(item) {
    if (!item.accessible) return '🔒';
    if (item.isDirectory) return '📁';
    return '📄';
  }

  function updateSizeBars() {
    const maxSize = Math.max(...currentItems.map(i => i.size || 0), 0);
    currentItems.forEach(item => {
      const row = fileListEl.querySelector(`[data-path="${CSS.escape(item.path)}"]`);
      if (!row) return;
      const barPct = maxSize > 0 ? Math.max((item.size / maxSize) * 100, item.size > 0 ? 1 : 0) : 0;
      const fill = row.querySelector('.size-bar-fill');
      if (fill) fill.style.width = barPct + '%';
    });
  }

  function renderBreadcrumb() {
    breadcrumbEl.innerHTML = '';
    breadcrumb.forEach((seg, idx) => {
      if (idx > 0) {
        const sep = document.createElement('span');
        sep.className = 'breadcrumb-sep';
        sep.textContent = '›';
        breadcrumbEl.appendChild(sep);
      }
      const item = document.createElement('span');
      item.className = 'breadcrumb-item' + (idx === breadcrumb.length - 1 ? ' active' : '');
      item.textContent = seg.name;
      if (idx < breadcrumb.length - 1) {
        item.addEventListener('click', () => navigateTo(seg.path, idx));
      }
      breadcrumbEl.appendChild(item);
    });
  }

  function renderFileList(data) {
    fileListEl.innerHTML = '';
    currentItems = [];

    if (data.error) {
      fileListEl.innerHTML = `<div class="access-denied-banner">Access denied: ${data.error}</div>`;
      itemCountEl.textContent = '';
      return;
    }

    currentItems = data.items;
    itemCountEl.textContent = `${currentItems.length} item${currentItems.length !== 1 ? 's' : ''}`;

    if (currentItems.length === 0) {
      fileListEl.innerHTML = '<div class="loading">This folder is empty.</div>';
      return;
    }

    const maxSize = Math.max(...currentItems.map(i => i.size || 0), 0);

    const header = document.createElement('div');
    header.className = 'file-list-header';
    header.innerHTML = '<span></span><span>Name</span><span>Size bar</span><span style="text-align:right">Size</span>';
    fileListEl.appendChild(header);

    currentItems.forEach(item => {
      const row = document.createElement('div');
      const classes = ['file-row'];
      if (item.isDirectory) classes.push('is-dir');
      if (!item.accessible) classes.push('inaccessible');
      row.className = classes.join(' ');
      row.dataset.path = item.path;

      const barPct = maxSize > 0 ? Math.max((item.size / maxSize) * 100, item.size > 0 ? 1 : 0) : 0;
      const sizeLabel = item.isDirectory
        ? (item.accessible ? '<span class="size-calculating">...</span>' : 'No access')
        : formatSize(item.size);

      row.innerHTML = `
        <div class="file-icon">${getIcon(item)}</div>
        <div class="file-name" title="${item.path}">${item.name}</div>
        <div class="size-bar-cell">
          <div class="size-bar-track">
            <div class="size-bar-fill" style="width: ${barPct}%"></div>
          </div>
        </div>
        <div class="file-size">${sizeLabel}</div>
      `;

      if (item.isDirectory && item.accessible) {
        row.addEventListener('click', () => {
          breadcrumb.push({ name: item.name, path: item.path });
          loadPath(item.path);
        });
      }

      fileListEl.appendChild(row);
    });
  }

  function calcFolderSizes(token) {
    const dirs = currentItems.filter(i => i.isDirectory && i.accessible);
    if (dirs.length === 0) return;

    dirs.forEach(async (item) => {
      const size = await window.diskAPI.getFolderSize(item.path);
      if (renderToken !== token) return;

      item.size = size;

      const row = fileListEl.querySelector(`[data-path="${CSS.escape(item.path)}"]`);
      if (!row) return;
      const sizeEl = row.querySelector('.file-size');
      if (sizeEl) sizeEl.textContent = formatSize(size);

      updateSizeBars();
    });
  }

  async function loadPath(dirPath) {
    currentPath = dirPath;
    currentItems = [];
    renderToken++;
    const token = renderToken;

    fileListEl.innerHTML = '<div class="loading">Loading...</div>';
    renderBreadcrumb();

    const atRoot = breadcrumb.length <= 1;
    btnBack.disabled = atRoot;

    try {
      const data = await window.diskAPI.getDirectoryContents(dirPath);
      if (renderToken !== token) return;
      renderFileList(data);
      calcFolderSizes(token);
    } catch (err) {
      fileListEl.innerHTML = `<div class="error-msg">Error: ${err.message}</div>`;
    }
  }

  function navigateTo(dirPath, breadcrumbIdx) {
    breadcrumb = breadcrumb.slice(0, breadcrumbIdx + 1);
    loadPath(dirPath);
  }

  async function goBack() {
    if (breadcrumb.length <= 1) {
      App.showDashboard();
      return;
    }
    breadcrumb.pop();
    const prev = breadcrumb[breadcrumb.length - 1];
    loadPath(prev.path);
  }

  function reload() {
    if (currentPath) loadPath(currentPath);
  }

  function load(rootPath) {
    const driveName = rootPath.replace(/[\\/]$/, '');
    breadcrumb = [{ name: driveName, path: rootPath }];
    loadPath(rootPath);
  }

  return { load, goBack, reload };
})();

App.showDashboard();
