document.addEventListener("DOMContentLoaded", function () {
const submenuParents = document.querySelectorAll(".has-submenu");

submenuParents.forEach(parentLi => {
    const parentLink = parentLi.querySelector("a");

    parentLink.setAttribute("aria-haspopup", "true");
    parentLink.setAttribute("aria-expanded", "false");

    function toggleSubmenu() {
    const isOpen = parentLi.classList.toggle("is-open");
    parentLink.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }

    parentLink.addEventListener("click", function (e) {
    e.preventDefault();
    //closeAllSubmenusExcept(parentLi);
    closeAllSubmenus();
    toggleSubmenu();
    });

    parentLink.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        //closeAllSubmenusExcept(parentLi);
        closeAllSubmenus();
        toggleSubmenu();
    }
    });
});

document.addEventListener("click", function (e) {
    if (!e.target.closest(".has-submenu")) {
    closeAllSubmenus();
    }
});

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
    closeAllSubmenus();
    }
});

function closeAllSubmenus() {
    submenuParents.forEach(li => {
    li.classList.remove("is-open");
    const link = li.querySelector("a");
    if (link) {
        link.setAttribute("aria-expanded", "false");
    }
    });
}

function closeAllSubmenusExcept(exception) {
    submenuParents.forEach(li => {
    if (li !== exception) {
        li.classList.remove("is-open");
        const link = li.querySelector("a");
        if (link) {
        link.setAttribute("aria-expanded", "false");
        }
    }
    });
}
});
