  document.querySelectorAll(".info-icon").forEach(icon => {
    icon.addEventListener("click", function () {
      const popup = this.nextElementSibling;
      popup.classList.toggle("active");
    });
  });