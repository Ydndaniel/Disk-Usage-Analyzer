const Dashboard = (() => {
  const grid = document.getElementById('drives-grid');

  const DRIVE_TYPE_LABELS = {
    2: 'Removable',
    3: 'Local Drive',
    4: 'Network Drive'
  };

  const DRIVE_TYPE_ICONS = {
    2: '💾',
    3: '💽',
    4: '🌐'
  };

  function formatSize(bytes) {
    if (bytes == null || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
  }

  function progressClass(pct) {
    if (pct >= 90) return 'red';
    if (pct >= 70) return 'orange';
    return 'green';
  }

  function renderCard(drive) {
    const pct = drive.Size > 0 ? Math.round((drive.UsedSpace / drive.Size) * 100) : 0;
    const card = document.createElement('div');
    card.className = 'drive-card';

    card.innerHTML = `
      <div class="drive-header">
        <div class="drive-icon">${DRIVE_TYPE_ICONS[drive.DriveType] || '💽'}</div>
        <div class="drive-labels">
          <div class="drive-letter">${drive.DeviceID}</div>
          <div class="drive-name">${drive.VolumeName || 'Local Disk'}</div>
        </div>
        <div class="drive-type-badge">${DRIVE_TYPE_LABELS[drive.DriveType] || 'Drive'}</div>
      </div>
      <div class="progress-track">
        <div class="progress-fill ${progressClass(pct)}" style="width: ${pct}%"></div>
      </div>
      <div class="drive-stats">
        <span><span class="used">${formatSize(drive.UsedSpace)}</span> used</span>
        <span>${pct}%</span>
        <span>${formatSize(drive.FreeSpace)} free</span>
      </div>
      <button class="btn-browse">Browse Files</button>
    `;

    card.querySelector('.btn-browse').addEventListener('click', (e) => {
      e.stopPropagation();
      App.showBrowser(drive.DeviceID + '\\');
    });

    card.addEventListener('click', () => {
      App.showBrowser(drive.DeviceID + '\\');
    });

    return card;
  }

  async function load() {
    grid.innerHTML = '<div class="loading">Loading drives...</div>';
    try {
      const drives = await window.diskAPI.getDrives();
      grid.innerHTML = '';
      if (drives.length === 0) {
        grid.innerHTML = '<div class="loading">No drives found.</div>';
        return;
      }
      drives.forEach(drive => grid.appendChild(renderCard(drive)));
    } catch (err) {
      grid.innerHTML = `<div class="error-msg">Failed to load drives: ${err.message}</div>`;
    }
  }

  return { load };
})();
