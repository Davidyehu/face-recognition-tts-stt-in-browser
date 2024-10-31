const container = document.querySelector(".container");
const video = document.getElementById("video");

Promise.all([
  faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
]).then(startWebcamAndAddButton);

function startWebcamAndAddButton() {
  navigator.mediaDevices
    .getUserMedia({
      video: true,
      audio: false,
    })
    .then((stream) => {
      video.srcObject = stream;
      const button = document.createElement("button");
      button.textContent = "Start Conversation";
      button.addEventListener("click", startConversation);
      container.appendChild(button);
    })
    .catch((error) => {
      console.error(error);
    });
}

function getLabeledFaceDescriptions() {
  const labels = ["David"];
  return Promise.all(
    labels.map(async (label) => {
      const descriptions = [];
      for (let i = 1; i <= 2; i++) {
        const img = await faceapi.fetchImage(`./labels/${label}/${i}.jpg`);
        const detections = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();
        descriptions.push(detections.descriptor);
      }
      return new faceapi.LabeledFaceDescriptors(label, descriptions);
    })
  );
}

const startConversation = async () => {
  const labeledFaceDescriptors = await getLabeledFaceDescriptions();
  const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors);

  const canvas = faceapi.createCanvasFromMedia(video);
  document.body.append(canvas);

  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition;
  var recognition = new SpeechRecognition();

  recognition.continuous = false;
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  const detections = await faceapi.detectAllFaces(video).withFaceLandmarks().withFaceDescriptors();

  const resizedDetections = faceapi.resizeResults(detections, displaySize);

  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

  const results = resizedDetections.map((d) => {
    return faceMatcher.findBestMatch(d.descriptor);
  });
  results.forEach((result, i) => {
    const box = resizedDetections[i].detection.box;
    const drawBox = new faceapi.draw.DrawBox(box, {
      label: result,
    });
    const synth = window.speechSynthesis;
    let name = result.toString().split(" ")[0];
    let ourText = `Hi ${name}, how are you doing today?`;
    const utterThis = new SpeechSynthesisUtterance(ourText);
    synth.speak(utterThis);
    drawBox.draw(canvas);

    utterThis.onend = function (event) {
      recognition.start();
      console.log("Ready to listen");
      const ready = document.createElement("p");
      ready.style.color = "green";
      ready.textContent = "Ready to listen:";
      container.appendChild(ready);

      recognition.onresult = function (event) {
        const speechResult = event.results[0][0].transcript;
        console.log(speechResult);
        const display = document.createElement("p");
        display.textContent = "You: " + speechResult;
        container.appendChild(display);
      };

      recognition.onspeechend = function () {
        recognition.stop();
        const end = document.createElement("p");
        end.style.color = "red";
        end.textContent = "Stopped listening";
        container.appendChild(end);
      };

      recognition.onnomatch = function (event) {
        console.log("no match");
      };

      recognition.onerror = function (event) {
        console.log("Error occurred in recognition: " + event.error);
      };
    };
  });
};
