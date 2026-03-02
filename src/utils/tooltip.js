let el = null;

export function getTooltip() {
  if (!el) {
    el = document.createElement('div');
    el.className = 'tooltip';
    el.style.position = 'absolute';
    el.style.backgroundColor = 'white';
    el.style.border = '1px solid black';
    el.style.borderRadius = '5px';
    el.style.padding = '10px';
    el.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
    el.style.zIndex = '1000';
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  return el;
}

export function showTooltip(html, x, y) {
  const tip = getTooltip();
  tip.innerHTML = html;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
  tip.style.display = 'block';
}

export function hideTooltip() {
  const tip = getTooltip();
  tip.style.display = 'none';
}
