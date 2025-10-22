// server/utils/colorUtils.js
function getRandomColor() {
  const colors = [
    "red",
    "green",
    "blue",
    "orange",
    "purple",
    "yellow",
    "cyan",
    "magenta",
    "lime",
    "pink",
    "teal",
    "brown",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

module.exports = { getRandomColor };
