//? Initialize DOM event listeners
document.addEventListener("DOMContentLoaded", function () {
  const socket = io();
  initializeSocketListeners(socket);
  attachUIEventListeners(socket);
});

//? Initialize socket listeners
function initializeSocketListeners(socket) {
  // Socket for ping output
  socket.on("command_output", (rawData) => {
    renderPingData(rawData);
  });
  // Socket for speed test output
  socket.on("command_output_speedtest", (rawData) => {
    renderSpeedtestData(rawData);
  });
  // Socket for save data output
  socket.on("save_data_output", (message) => {
    alert(message);
    sessionStorage.removeItem("speedtest");
    sessionStorage.removeItem("ping");
    sessionStorage.removeItem("time");
    fillExportData(socket);
    unlockUI();
  });
  // Socket for export data output
  socket.on("export_data_output", (url) => {
    window.open(url, "_blank");
    unlockUI();
  });
  // Socket for remove data output
  socket.on("remove_data_output", (message) => {
    alert(message);
    fillExportData(socket);
    unlockUI();
  });
  // Socket for error output
  socket.on("command_error", (errorMessage) => {
    console.error(errorMessage);
    unlockUI();
  });
}

//? Initialize UI event listeners
function attachUIEventListeners(socket) {
  const startButton = document.getElementById("start");
  const exportButton = document.getElementById("export");
  const closeButton = document.getElementById("close");
  const saveDataButton = document.getElementById("saveData");
  const removeDataButton = document.getElementById("removeData");
  const exportDataButton = document.getElementById("exportData");
  const selectAllFilesCheckbox = document.getElementById("selectAllFiles");
  const exportMenu = document.getElementById("exportMenu");

  // Start test listener
  startButton.addEventListener("click", () => {
    const [url, cycles, ping, speedtest] = validStartData();
    if (url) {
      loadingAnimation(ping, speedtest);
      sessionStorage.setItem("time", getDate());
      socketEmitEvent(socket, "run_test", { url, cycles, ping, speedtest });
    }
  });
  // Open export menu listener
  exportButton.addEventListener("click", () => {
    fillExportData(socket);
    unlockUI();
    exportMenu.classList.remove("hidden");
  });
  // Close export menu listener
  closeButton.addEventListener("click", () => {
    exportMenu.classList.add("hidden");
    selectAllFilesCheckbox.checked = false;
  });
  // Save data listener
  saveDataButton.addEventListener("click", () => {
    let speedtest = sessionStorage.getItem("speedtest");
    let ping = sessionStorage.getItem("ping");
    const time = sessionStorage.getItem("time");
    speedtest = speedtest ? JSON.parse(speedtest) : undefined;
    ping = ping ? JSON.parse(ping) : undefined;
    if (!time) {
      alert("No data to save");
    } else {
      lockUI();
      socketEmitEvent(socket, "save_data", { speedtest, ping, time });
    }
  });
  // Remove data listener
  removeDataButton.addEventListener("click", async () => {
    const selectedFiles = await checkSelectedFiles();
    if (selectedFiles.length <= 0) {
      alert("Please select at least one file to remove");
      return;
    }
    lockUI();
    socketEmitEvent(socket, "remove_data", selectedFiles);
  });
  // Export data listener
  exportDataButton.addEventListener("click", async () => {
    const selectedFiles = await checkSelectedFiles();
    if (selectedFiles.length <= 0) {
      alert("Please select at least one file to export");
      return;
    }
    const socketAction =
      selectedFiles.length === 1 ? "export_data" : "export_multiple_data";
    const typeData = document.getElementById("typeData").value;
    lockUI();
    socketEmitEvent(socket, socketAction, {
      data: selectedFiles,
      format: typeData,
    });
  });
  // Select all files listener
  selectAllFilesCheckbox.addEventListener("click", () => {
    document
      .querySelectorAll("#saveDataList input[type='checkbox']")
      .forEach((checkbox) => {
        checkbox.checked = selectAllFilesCheckbox.checked;
      });
  });
}

//? Show ping results
const renderPingData = (rawData) => {
  // Parse mtr exec output
  const data = rawData
    .split("\n")
    .slice(2)
    .map((row) => {
      const [step, host, loss, sent, last, avg, best, worst, stdev] = row
        .trim()
        .split(/\s+/)
        .map((c) => c.replace("|--", "").trim());
      return { step, host, loss, sent, last, avg, best, worst, stdev };
    })
    .filter((item) => item.step);
  // Save data to local storage
  sessionStorage.setItem("ping", JSON.stringify(data));
  // Insert data to table
  const tableBody = document
    .getElementById("pingData")
    .getElementsByTagName("tbody")[0];
  tableBody.innerHTML = data
    .map(
      ({ step, host, loss, sent, last, avg, best, worst, stdev }) =>
        `<tr>${[step, host, loss, sent, last, avg, best, worst, stdev]
          .map((text) => `<td>${text}</td>`)
          .join("")}</tr>`
    )
    .join("");
  // Insert total ping value
  const totalPingValue = data[data.length - 1]?.avg || "0";
  const totalPing = document.getElementById("totalPing");
  totalPing.textContent = `Total ping: ${totalPingValue}ms`;
  // Clear loading animation
  document.getElementById("ping").classList.remove("working");
  document.getElementById("charts").classList.remove("hidden");
  checkTestStatus();
  // Render ping chart
  chart(data);
};

//? Show speed test results
const renderSpeedtestData = (rawData) => {
  // Parse speed test exec output
  const data = JSON.parse(rawData);
  const tableBody = document.getElementById("speedtestData");
  tableBody.innerHTML = "";
  // Subfunction to append list to table
  const appendList = (title, items) => {
    const list = document.createElement("li");
    let content = `<h3>${title}</h3><ul>`;
    items.forEach((item) => (content += `<li>${item}</li>`));
    content += "</ul>";
    list.innerHTML = content;
    tableBody.appendChild(list);
  };
  // Append data to table
  appendList("Client", [
    `Your IP: ${data.client.ip}`,
    `ISP Name: ${data.client.isp}`,
    `ISP Rating: ${data.client.isprating}`,
    `Country: ${data.client.country}`,
  ]);
  appendList("Server", [
    `Host: ${data.server.host}`,
    `Sponsor: ${data.server.sponsor}`,
    `Country: ${data.server.country} - ${data.server.name}`,
    `Distance: ${data.server.d.toFixed(2)} km`,
  ]);
  // Insert total speed test value
  const download = (data.download / 1024 / 1024).toFixed(2);
  const upload = (data.upload / 1024 / 1024).toFixed(2);
  document.getElementById(
    "totalDownload"
  ).innerHTML = `Download: ${download} Mbps`;
  document.getElementById("totalUpload").innerHTML = `Upload: ${upload} Mbps`;
  // Save data to local storage
  const temp = [
    {
      download: download,
      upload: upload,
      ip: data.client.ip,
      isp: data.client.isp,
      isp_rating: data.client.isprating,
      country: data.client.country,
      server: data.server.host,
      server_country: data.server.country,
      distance: data.server.d.toFixed(2),
      server_name: data.server.name,
      sponsor: data.server.sponsor,
    },
  ];
  sessionStorage.setItem("speedtest", JSON.stringify(temp));
  // Clear loading animation
  document.getElementById("speedtest").classList.remove("working");
  checkTestStatus();
};

//? Check test status to unlock buttons
const checkTestStatus = () => {
  const ping = document.getElementById("ping").classList.contains("working");
  const speedtest = document
    .getElementById("speedtest")
    .classList.contains("working");
  if (!ping && !speedtest) {
    document.getElementById("start").disabled = false;
    document.getElementById("export").disabled = false;
  }
};

//? Add loading animation
const loadingAnimation = (ping, speedtest) => {
  if (ping) document.getElementById("ping").classList.add("working");
  if (speedtest) document.getElementById("speedtest").classList.add("working");
  lockUI();
};

//? Lock buttons
const lockUI = () => {
  document.getElementById("start").disabled = true;
  document.getElementById("export").disabled = true;
  document.getElementById("typeData").disabled = true;
  document.getElementById("exportData").disabled = true;
  document.getElementById("saveData").disabled = true;
  document.getElementById("removeData").disabled = true;
  document.getElementById("close").disabled = true;
};

//? Unlock buttons
const unlockUI = () => {
  document.getElementById("start").disabled = false;
  document.getElementById("export").disabled = false;
  document.getElementById("typeData").disabled = false;
  document.getElementById("exportData").disabled = false;
  document.getElementById("saveData").disabled = false;
  document.getElementById("removeData").disabled = false;
  document.getElementById("close").disabled = false;
};

//? Validate selected data before start test
function validStartData() {
  let url = document.getElementById("pingHost").value;
  url = url.replace(/^(http:\/\/|https:\/\/)/, "");
  const cycles = document.getElementById("pingSend").value;
  const ping = document.getElementById("pingCheckbox").checked;
  const speedtest = document.getElementById("speedtestCheckbox").checked;

  if (
    url === "" ||
    isNaN(cycles) ||
    cycles < 1 ||
    cycles > 1000 ||
    !url.includes(".")
  ) {
    alert("Please enter a valid input");
    return [null, null, null, null];
  }

  return [url, cycles, ping, speedtest];
}

//? Get date and time for file name
const getDate = () => {
  var d = new Date();
  var datestring =
    ("0" + d.getDate()).slice(-2) +
    "-" +
    ("0" + (d.getMonth() + 1)).slice(-2) +
    "-" +
    d.getFullYear() +
    " " +
    ("0" + d.getHours()).slice(-2) +
    ":" +
    ("0" + d.getMinutes()).slice(-2);
  return datestring;
};

//? Load data to export menu
async function fillExportData(socket) {
  const tableBody = document
    .getElementById("saveDataList")
    .getElementsByTagName("tbody")[0];
  tableBody.innerHTML = "";

  socket.emit("fill_export_data", "csv");
  socket.once("fill_export_data_output", function (rawData) {
    rawData.reverse();
    rawData.forEach((fileName) => {
      const tr = document.createElement("tr");
      const tdCheckbox = document.createElement("td");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "file";
      input.value = fileName.split(".")[0];
      tdCheckbox.appendChild(input);

      const tdName = document.createElement("td");
      tdName.textContent = fileName.split(".")[0];

      tr.appendChild(tdCheckbox);
      tr.appendChild(tdName);
      tableBody.appendChild(tr);
    });
  });
}

//? Check selected files in export menu
async function checkSelectedFiles() {
  const checkboxes = document.querySelectorAll(
    "#saveDataList tbody input[type='checkbox']:checked"
  );
  return Array.from(checkboxes).map((checkbox) => checkbox.value);
}

//? Emit socket event
function socketEmitEvent(socket, event, data = {}) {
  socket.emit(event, data);
}

//? Ping chart
let combinedChart;
const chart = (data) => {
  data = data.filter((el) => el.avg !== undefined);
  const labels = data.map((item) => item.host);
  const avgPing = data.map((item) => parseFloat(item.avg));
  const packetLoss = data.map((item) => parseFloat(item.loss.replace("%", "")));

  const ctx = document.getElementById("chart").getContext("2d");

  if (combinedChart) {
    combinedChart.data.labels = labels;
    combinedChart.data.datasets[0].data = avgPing;
    combinedChart.data.datasets[1].data = packetLoss;
    combinedChart.update();
  } else {
    combinedChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Ping time (ms)",
            data: avgPing,
            type: "line",
            borderColor: "rgba(255, 99, 132, 1)",
            borderWidth: 4,
            fill: false,
          },
          {
            label: "Packet lost (%)",
            data: packetLoss,
            backgroundColor: "rgba(54, 162, 235, 0.2)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "Value",
            },
          },
        },
      },
    });
  }
};

//? Rescale chart on window resize
window.addEventListener("resize", () => {
  if (combinedChart) combinedChart.resize();
});
