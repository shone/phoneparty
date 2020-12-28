import {lerp} from '/common/utils.mjs';

export function drawPhotoOntoCanvas(photo, canvas, {cropAmount=0}) {
  const fullyCroppedSize = Math.min(photo.width, photo.height) / 3;
  const cropWidth  = lerp(photo.width,  fullyCroppedSize, cropAmount);
  const cropHeight = lerp(photo.height, fullyCroppedSize, cropAmount);
  canvas.width  = cropWidth;
  canvas.height = cropHeight;
  const context = canvas.getContext('2d');

  context.drawImage(
    photo,
    (photo.width / 2) - (cropWidth / 2), (photo.height / 2) - (cropHeight / 2), // Source position
    cropWidth, cropHeight, // Source dimensions
    0, 0, // Destination position
    cropWidth, cropHeight // Destination dimensions
  );

  // Crop
  const uncroppedDiameter = Math.sqrt((photo.width * photo.width) + (photo.height * photo.height));
  const cropDiameter = lerp(uncroppedDiameter, fullyCroppedSize, cropAmount);
  context.globalCompositeOperation = 'destination-atop';
  context.beginPath();
  context.arc(
    cropWidth / 2, cropHeight / 2, // Position
    cropDiameter / 2, // Radius
    0, Math.PI * 2 // Angles
  );
  context.fill();
}
