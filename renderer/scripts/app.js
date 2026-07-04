const App = (() => {
  const dashboardView = document.getElementById('dashboard-view');
  const browserView = document.getElementById('browser-view');
  const btnBack = document.getElementById('btn-back');
  const btnRefresh = document.getElementById('btn-refresh');

  let currentView = 'dashboard';

  function showDashboard() {
    currentView = 'dashboard';
    dashboardView.classList.remove('hidden');
    browserView.classList.add('hidden');
    btnBack.disabled = true;
    Dashboard.load();
  }

  function showBrowser(drivePath) {
    currentView = 'browser';
    dashboardView.classList.add('hidden');
    browserView.classList.remove('hidden');
    btnBack.disabled = false;
    Browser.load(drivePath);
  }

  btnBack.addEventListener('click', () => {
    if (currentView === 'browser') {
      Browser.goBack();
    }
  });

  btnRefresh.addEventListener('click', () => {
    if (currentView === 'dashboard') {
      Dashboard.load();
    } else {
      Browser.reload();
    }
  });

  return { showDashboard, showBrowser };
})();
