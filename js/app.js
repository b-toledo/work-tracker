const pageTitles = {
  home: "Home",
  worklog: "Work Log",
  summary: "Daily Summary",
  stats: "Stats",
  settings: "Settings"
};

const pageTitle = document.querySelector("#page-title");

const navigationButtons = document.querySelectorAll(
  "[data-view]"
);

const bottomNavigationButtons = document.querySelectorAll(
  ".navigation-button"
);

const views = document.querySelectorAll(".view");

function openView(viewName) {
  const selectedView = document.querySelector(
    `#${viewName}-view`
  );

  if (!selectedView) {
    console.error(`View "${viewName}" was not found.`);
    return;
  }

  views.forEach((view) => {
    view.hidden = true;
    view.classList.remove("active-view");
  });

  selectedView.hidden = false;
  selectedView.classList.add("active-view");

  pageTitle.textContent = pageTitles[viewName];

  bottomNavigationButtons.forEach((button) => {
    const isSelected =
      button.dataset.view === viewName;

    button.classList.toggle(
      "active-navigation",
      isSelected
    );

    button.setAttribute(
      "aria-current",
      isSelected ? "page" : "false"
    );
  });
}

navigationButtons.forEach((button) => {
  button.addEventListener("click", () => {
    openView(button.dataset.view);
  });
});

console.log("Work Tracker interface loaded.");