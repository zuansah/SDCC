const mainData = { a: 'foo', networkTopologyImg: 'largebase64' };
const IMAGE_FIELDS = ['networkTopologyImg'];

IMAGE_FIELDS.forEach(field => {
  if (mainData[field]) {
    delete mainData[field];
  }
});
console.log(mainData);
