/* The first release only loads story data; the real map comes later. */
(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const status = byId("data-status");
  const retry = byId("retry-button");
  const list = byId("memory-list");
  const about = byId("about-dialog");

  if (typeof about.showModal === "function") {
    byId("about-button").hidden = false;
    byId("about-button").addEventListener("click", () => about.showModal());
    byId("close-dialog").addEventListener("click", () => about.close());
    about.addEventListener("click", (event) => {
      const rect = about.getBoundingClientRect();
      if (event.target === about && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) about.close();
    });
  }

  function validateData(data) {
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.memories)) throw new Error("Invalid memory data");
    const ids = new Set();
    for (const memory of data.memories) {
      if (!memory || typeof memory.id !== "string" || !memory.id.trim() || ids.has(memory.id) || typeof memory.title !== "string" || !memory.title.trim()) throw new Error("Invalid memory item");
      ids.add(memory.id);
      for (const field of ["place", "date", "description"]) {
        if (memory[field] != null && typeof memory[field] !== "string") throw new Error(`Invalid ${field}`);
      }
    }
    return data.memories;
  }

  function renderMemories(memories) {
    const fragment = document.createDocumentFragment();
    for (const memory of memories) {
      const card = document.createElement("article");
      card.className = "memory-card";
      const meta = document.createElement("p");
      meta.className = "memory-meta";
      meta.textContent = [memory.place, memory.date].filter(Boolean).join(" · ");
      const title = document.createElement("h3");
      title.textContent = memory.title;
      const description = document.createElement("p");
      description.textContent = memory.description || "";
      card.append(meta, title, description);
      fragment.append(card);
    }
    list.replaceChildren(fragment);
    const places = new Set(memories.map((memory) => memory.place?.trim()).filter(Boolean));
    byId("place-count").textContent = String(places.size).padStart(2, "0");
    byId("memory-count").textContent = String(memories.length).padStart(2, "0");
    status.textContent = memories.length ? "故事已经收好，地图将在下一版展开。" : "还没有故事。留白，是为了往后慢慢填满。";
  }

  async function loadData() {
    retry.hidden = true;
    status.textContent = "正在翻开收藏册…";
    document.documentElement.dataset.state = "loading";
    try {
      // The standalone preview uses embedded data; production reads the JSON file.
      const embedded = byId("memory-preview-data");
      let data;
      if (embedded) data = JSON.parse(embedded.textContent);
      else {
        const response = await fetch("./data/memories.json", { cache: "no-cache", signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        data = await response.json();
      }
      renderMemories(validateData(data));
      document.documentElement.dataset.state = "ready";
    } catch (error) {
      list.replaceChildren();
      byId("place-count").textContent = "—";
      byId("memory-count").textContent = "—";
      status.textContent = location.protocol === "file:" ? "直接打开项目文件时无法读取故事数据。请使用 README 中的本地预览命令，或打开单文件预览版。" : "故事暂时没有读到。请重新读取，或检查故事数据文件。";
      retry.hidden = false;
      document.documentElement.dataset.state = "error";
      console.warn("Memory data could not be loaded:", error.message);
    }
  }
  retry.addEventListener("click", loadData);
  loadData();
})();
