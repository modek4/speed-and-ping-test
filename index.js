const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { exec } = require("child_process");
const fs = require("fs");
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const { v4: uuidv4 } = require("uuid");
const path = require("path");
//*=================================================*//
const PORT = 80; //!CHANGE HERE
const protocol = "http"; //!CHANGE HERE
const localpath = "127.0.0.1"; //!CHANGE HERE
//*=================================================*//

app.use(express.static("public"));

//? Routes main page
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

//? Routes download csv files
app.get("/download/csv/:filename", (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, "csv", filename);

  fs.existsSync(filePath)
    ? res.download(filePath)
    : res.status(404).send("File not found.");
});

//? Routes download json files
app.get("/download/json/:filename", (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, "json", filename);

  fs.existsSync(filePath)
    ? res.download(filePath)
    : res.status(404).send("File not found.");
});

//? Routes download joined files
app.get("/download/temp/:filename", (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, "temp", filename);

  res.download(filePath, (err) => {
    err ? res.status(500).send("Could not download the file.") : null;
  });
});

//? Sanitize input parameters for socket commands "run_test"
const sanitizeInputParameters = (url, cycles, ping, speedtest) => {
  const sanitizedUrl = url.replace(/[^a-zA-Z0-9.-]/g, "").toLowerCase();
  if (!sanitizedUrl.match(/^[a-zA-Z0-9.-]+$/)) throw new Error("Invalid URL");
  const sanitizedCycles = parseInt(cycles, 10);
  if (isNaN(sanitizedCycles) || sanitizedCycles <= 0)
    throw new Error("Invalid cycles count");
  const sanitizedPing = ping === true ? true : false;
  const sanitizedSpeedtest = speedtest === true ? true : false;
  return { sanitizedUrl, sanitizedCycles, sanitizedPing, sanitizedSpeedtest };
};

//? Run ping test
const pingTest = async (url, cycles, socket) => {
  let command = `mtr --report --report-cycles ${cycles} ${url}`;
  console.log(`User running ping test: ${command}`);
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      socket.emit("command_error", error.message);
      return;
    }
    socket.emit("command_output", stdout);
  });
  return true;
};

//? Run speed test
const speedTest = async (socket) => {
  let command = `/usr/local/bin/speedtest-cli --secure --json`;
  console.log(`User running speed test: ${command}`);
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      socket.emit("command_error", error.message);
      return;
    }
    socket.emit("command_output_speedtest", stdout);
  });
  return true;
};

//? Save data to csv and json files
const saveData = async (exportData) => {
  if (exportData.ping === undefined && exportData.speedtest === undefined)
    return false;
  // Create csv file
  if (!fs.existsSync("csv")) fs.mkdirSync("csv");
  const fileName = `csv/${exportData.time + ".csv"}`;
  let csv = "";
  if (exportData.ping !== undefined) {
    csv += `step,host,loss %,sent,last (ms),avg (ms),best (ms),worst (ms),stdev,,${exportData.time}\n`;
    exportData.ping.forEach((row) => {
      csv += `${row.step},${row.host},${row.loss},${row.sent},${row.last},${row.avg},${row.best},${row.worst},${row.stdev}\n`;
    });
    csv += "\n\n";
  }
  if (exportData.speedtest !== undefined) {
    csv +=
      "download (Mbps),upload (Mbps),ip,isp,isp_rating,country,server,server_country,distance (km),server_name,sponsor\n";
    exportData.speedtest.forEach((row) => {
      csv += `${row.download},${row.upload},${row.ip},${row.isp},${row.isp_rating},${row.country},${row.server},${row.server_country},${row.distance},${row.server_name},${row.sponsor}\n`;
    });
  }
  fs.writeFile(fileName, csv, (err) => {
    if (err) {
      console.error(`writeFile error: ${err}`);
      socket.emit("command_error", err.message);
      return;
    }
  });
  // Create json file
  if (!fs.existsSync("json")) fs.mkdirSync("json");
  const jsonFileName = `json/${exportData.time + ".json"}`;
  fs.writeFile(jsonFileName, JSON.stringify(exportData), (err) => {
    if (err) {
      console.error(`writeFile error: ${err}`);
      socket.emit("command_error", err.message);
      return;
    }
  });
  console.log(`User saved data to csv and json files: ${exportData.time}`);
  return true;
};

//? Remove data from csv and json directories
const removeData = async (selectedFiles) => {
  let deleted = true;
  selectedFiles.forEach((file) => {
    const jsonFilePath = path.join(__dirname, "json", `${file}.json`);
    const csvFilePath = path.join(__dirname, "csv", `${file}.csv`);
    fs.existsSync(jsonFilePath)
      ? fs.unlinkSync(jsonFilePath)
      : (deleted = false);
    fs.existsSync(csvFilePath) ? fs.unlinkSync(csvFilePath) : (deleted = false);
  });
  console.log(
    "User removed data: ",
    selectedFiles.map((file) => `${file}.json, ${file}.csv`)
  );
  return deleted;
};

//? Write data to one file
const writeFiles = async (mergedFilePath, object) => {
  const writeStream = fs.createWriteStream(mergedFilePath);
  if (object.format === "json") {
    const jsonFiles = object.data.map((file) => {
      return fs.readFileSync(path.join(__dirname, "json", file + ".json"));
    });
    const mergedJson = jsonFiles.map((file) => JSON.parse(file));
    writeStream.write(JSON.stringify(mergedJson));
  } else if (object.format === "csv") {
    const csvFiles = object.data.map((file) => {
      return fs.readFileSync(path.join(__dirname, "csv", file + ".csv"));
    });
    writeStream.write(csvFiles.join("\n"));
  }
  writeStream.end();
  return writeStream;
};

//? Remove temporary file
const removeTempFile = (timeout, mergedFilePath) => {
  setTimeout(() => {
    fs.unlink(mergedFilePath, (err) => {
      err
        ? console.error(`Error deleting temporary file: ${err}`)
        : console.log(`Temporary file deleted: ${mergedFilePath}`);
    });
  }, timeout);
};

//? Get file URL
const fileUrl = (extension, fileName) => {
  const hostAddress =
    server.address().address === "::" ? localpath : server.address().address;
  return `${protocol}://${hostAddress}:${PORT}/download/${extension}/${fileName}`;
};

//? Socket.io connection
io.on("connection", (socket) => {
  console.log("User connected");

  //? Run ping & speed test
  socket.on("run_test", (params) => {
    const { sanitizedUrl, sanitizedCycles, sanitizedPing, sanitizedSpeedtest } =
      sanitizeInputParameters(
        params.url,
        params.cycles,
        params.ping,
        params.speedtest
      );
    // Run ping test
    const ping =
      sanitizedPing === true
        ? pingTest(sanitizedUrl, sanitizedCycles, socket)
        : false;
    // Run speedtest
    const speed = sanitizedSpeedtest === true ? speedTest(socket) : false;
    if (!ping && !speed) socket.emit("command_error", "No test selected");
  });

  //? Save data to csv and json files
  socket.on("save_data", async (exportData) => {
    const saved = await saveData(exportData);
    saved == true
      ? socket.emit("save_data_output", `Data saved to ${exportData.time}`)
      : socket.emit("command_error", "Error saving data");
  });

  //? Remove data from csv and json directories
  socket.on("remove_data", async (selectedFiles) => {
    const deleted = await removeData(selectedFiles);
    deleted == true
      ? socket.emit("remove_data_output", `Data removed`)
      : socket.emit("command_error", "Error removing data");
  });

  //? Download data
  socket.on("export_data", async (object) => {
    const fileName = `${object.data}.${object.format}`;
    const filePath = path.join(__dirname, object.format, fileName);

    if (fs.existsSync(filePath)) {
      console.log(`User downloaded file: ${object.data}.${object.format}`);
      socket.emit("export_data_output", fileUrl(object.format, fileName));
    } else {
      socket.emit("command_error", "File does not exist.");
    }
  });

  //? Download multiple data
  socket.on("export_multiple_data", async (object) => {
    if (!fs.existsSync("temp")) fs.mkdirSync("temp");
    const mergedFileName = `merged-${uuidv4()}.${object.format}`;
    const mergedFilePath = path.join(__dirname, "temp", mergedFileName);

    const writeStream = await writeFiles(mergedFilePath, object);

    writeStream.on("finish", () => {
      console.log(`User downloaded multiple files in ${object.format}`);
      socket.emit("export_data_output", fileUrl("temp", mergedFileName));
      removeTempFile(15000, mergedFilePath);
    });
    writeStream.on("error", (err) => {
      console.error(`Error writing to file: ${err}`);
      socket.emit("command_error", "Error creating download file.");
    });
  });

  //? Load export data to display in the UI
  socket.on("fill_export_data", async (extension) => {
    if (!fs.existsSync(extension)) fs.mkdirSync(extension);
    const files = fs.readdirSync(extension);
    socket.emit("fill_export_data_output", files);
  });

  //? Disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

//? Start server
server.listen(PORT, () => {
  console.log(`Listening on ${localpath}:${PORT}`);
});
