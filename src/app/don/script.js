const downloadButton = document.querySelector('.download-btn');
const toast = document.querySelector('.toast');

if (downloadButton && toast) {
  downloadButton.addEventListener('click', () => {
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3600);
  });
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
