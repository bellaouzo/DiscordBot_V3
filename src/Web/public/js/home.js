let allCommands = [];

async function loadCommands() {
  const grid = document.getElementById('commands-grid');
  const filters = document.getElementById('category-filters');
  try {
    const res = await fetch('/api/commands');
    if (!res.ok) throw new Error('Failed to fetch');
    allCommands = await res.json();
    
    allCommands.sort((a, b) => a.name.localeCompare(b.name));
    
    const groups = ['All', ...new Set(allCommands.map(c => c.group))].sort();
    
    filters.innerHTML = groups.map(g => `
      <button class="filter-btn ${g === 'All' ? 'active' : ''}" data-group="${g}">${g.toUpperCase()}</button>
    `).join('');

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        renderCommands(e.target.getAttribute('data-group'));
      });
    });

    renderCommands('All');
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<p class="error-text">Failed to load commands.</p>';
  }
}

function renderCommands(filterGroup) {
  const grid = document.getElementById('commands-grid');
  const filtered = filterGroup === 'All' ? allCommands : allCommands.filter(c => c.group === filterGroup);
  
  grid.innerHTML = filtered.map(cmd => `
    <div class="command-card modern">
      <div class="command-header">
        <span class="command-name">/${cmd.name}</span>
        <span class="command-group tag-${cmd.group.toLowerCase()}">${cmd.group}</span>
      </div>
      <div class="command-body">
        <p class="command-desc">${cmd.description}</p>
      </div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', loadCommands);
