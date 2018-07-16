mapboxgl.accessToken = 'pk.eyJ1IjoibW91cm5lciIsImEiOiJWWnRiWG1VIn0.j6eccFHpE3Q04XPLI7JxbA';

var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/cjf4m44iw0uza2spb3q0a7s41',
    center: [-73.992, 40.734],
    zoom: 12,
    hash: true
});

var h = 300;
var r = h / 2;
var numBins = 64;

var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');

canvas.style.width = canvas.style.height = h + 'px';
canvas.width = canvas.height = h;

if (window.devicePixelRatio > 1) {
    canvas.width = canvas.height = h * 2;
    ctx.scale(2, 2);
}

function updateOrientations() {
    ctx.clearRect(0, 0, h, h);

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(r, r, r, 0, 2 * Math.PI, false);
    ctx.fill();

    var features = map.queryRenderedFeatures({layers: ['road']});
    if (features.length === 0) return;

    var ruler = cheapRuler(map.getCenter().lat);
    var bounds = map.getBounds();
    var bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    var bearing = map.getBearing();
    var bins = new Float64Array(numBins);

    for (var i = 0; i < features.length; i++) {
        var geom = features[i].geometry;
        var lines = geom.type === 'LineString' ? [geom.coordinates] : geom.coordinates;
        var clippedLines = [];
        for (var j = 0; j < lines.length; j++) {
            clippedLines.push.apply(clippedLines, lineclip(lines[j], bbox));
        }
        for (j = 0; j < clippedLines.length; j++) {
            analyzeLine(bins, ruler, clippedLines[j], features[i].properties.oneway !== 'true');
        }
    }

    var max = Math.max.apply(null, bins);

    for (i = 0; i < numBins; i++) {
        var a0 = ((i - 0.5) * 360 / numBins - 90 - bearing) * Math.PI / 180;
        var a1 = ((i + 0.5) * 360 / numBins - 90 - bearing) * Math.PI / 180;
        ctx.fillStyle = interpolateSinebow((2 * i % numBins) / numBins);
        ctx.beginPath();
        ctx.moveTo(r, r);
        ctx.arc(r, r, r * Math.sqrt(bins[i] / max), a0, a1, false);
        ctx.closePath();
        ctx.fill();
    }
}

function analyzeLine(bins, ruler, line, isTwoWay) {
    for (var i = 0; i < line.length - 1; i++) {
        var b = ruler.bearing(line[i], line[i + 1]);
        var d = ruler.distance(line[i], line[i + 1]);

        var k = Math.round((b + 360) * numBins / 360) % numBins;
        var k2 = Math.round((b + 180) * numBins / 360) % numBins;

        bins[k] += d;
        if (isTwoWay) bins[k2] += d;
    }
}

function interpolateSinebow(t) {
    t = 0.5 - t;
    var r = 250 * Math.pow(Math.sin(Math.PI * (t + 0 / 3)), 2);
    var g = 250 * Math.pow(Math.sin(Math.PI * (t + 1 / 3)), 2);
    var b = 250 * Math.pow(Math.sin(Math.PI * (t + 2 / 3)), 2);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
}

map.on('load', () => {
    updateOrientations();
    map.on('moveend', updateOrientations);
});
