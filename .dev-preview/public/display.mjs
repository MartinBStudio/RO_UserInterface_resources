export function dimensions(resolution, width, height, availableWidth, availableHeight) {
  if (resolution === 'auto') return {width:Math.max(1,Math.floor(availableWidth)),height:Math.max(1,Math.floor(availableHeight))};
  const values = resolution === 'custom' ? [width,height] : resolution.split('x');
  return {
    width:Math.round(Math.max(320,Math.min(7680,Number(values[0]) || 1920))),
    height:Math.round(Math.max(240,Math.min(4320,Number(values[1]) || 1080)))
  };
}
export function fitScale(width, height, availableWidth, availableHeight) {
  return Math.min(1,Math.max(1,availableWidth)/width,Math.max(1,availableHeight)/height);
}
