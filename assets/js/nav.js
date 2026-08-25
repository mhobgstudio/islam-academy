/* shared nav + theme */
(function () {
  const pages = [
    ["index.html", "Home", "../index.html"],
    ["alphabet.html", "Alphabet"],
    ["reading.html", "Reading"],
    ["grammar.html", "Lessons"],
    ["vocabulary.html", "Vocabulary"],
    ["quran-reader.html", "Quran"],
    ["tajweed.html", "Tajweed"],
    ["hifz.html", "Hifz"],
    ["progress.html", "Progress"],
  ];
  const nav = document.getElementById("main-nav");
  if (!nav) return;
  const here = location.pathname.split("/").pop() || "index.html";
  const inPages = here !== "index.html";
  pages.forEach(([file, label]) => {
    const href = inPages ? (file === "index.html" ? "../index.html" : file) : (file === "index.html" ? "index.html" : "pages/" + file);
    const a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    if (here === file) a.classList.add("active");
    nav.appendChild(a);
  });
  // theme toggle
  const saved = localStorage.getItem("islam-academy-v1");
  let theme = "light";
  try { theme = JSON.parse(saved).settings.theme || "light"; } catch (e) {}
  applyTheme(theme);
  const btn = document.createElement("button");
  btn.className = "btn ghost small";
  btn.style.marginLeft = "8px";
  btn.textContent = theme === "dark" ? "☀️" : "🌙";
  btn.onclick = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    btn.textContent = next === "dark" ? "☀️" : "🌙";
    try {
      const st = JSON.parse(localStorage.getItem("islam-academy-v1"));
      st.settings.theme = next;
      localStorage.setItem("islam-academy-v1", JSON.stringify(st));
    } catch (e) {}
  };
  nav.appendChild(btn);

  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
  }
})();
