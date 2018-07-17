// my personal token - please generate your own at https://www.mapbox.com/studio/
mapboxgl.accessToken = 'pk.eyJ1IjoibW91cm5lciIsImEiOiJWWnRiWG1VIn0.j6eccFHpE3Q04XPLI7JxbA';

// initialize a Mapbox map with the Basic style, centered in New York
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/cjf4m44iw0uza2spb3q0a7s41',
    center: [-73.992, 40.734],
    zoom: 12,
    hash: true
});

map.addControl(new MapboxGeocoder({accessToken: mapboxgl.accessToken}), 'bottom-right');
map.addControl(new mapboxgl.NavigationControl(), 'top-left');

var h = 300; // size of the chart canvas
var r = h / 2; // radius of the polar histogram
var numBins = 64; // number of orientation bins spread around 360 deg.

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

    var bearing = map.getBearing();

    ctx.save();
    ctx.translate(r, r);
    ctx.rotate(-bearing * Math.PI / 180);

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 2 * Math.PI, false);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.stroke();

    var features = map.queryRenderedFeatures({layers: ['road']});
    if (features.length === 0) {
        ctx.restore();
        return;
    }

    var ruler = cheapRuler(map.getCenter().lat);
    var bounds = map.getBounds();
    var bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    var bins = new Float64Array(numBins);

    for (var i = 0; i < features.length; i++) {
        var geom = features[i].geometry;
        var lines = geom.type === 'LineString' ? [geom.coordinates] : geom.coordinates;

        // clip lines to screen bbox for more exact analysis
        var clippedLines = [];
        for (var j = 0; j < lines.length; j++) {
            clippedLines.push.apply(clippedLines, lineclip(lines[j], bbox));
        }

        // update orientation bins from each clipped line
        for (j = 0; j < clippedLines.length; j++) {
            analyzeLine(bins, ruler, clippedLines[j], features[i].properties.oneway !== 'true');
        }
    }

    var binMax = Math.max.apply(null, bins);

    for (i = 0; i < numBins; i++) {
        var a0 = ((i - 0.5) * 360 / numBins - 90) * Math.PI / 180;
        var a1 = ((i + 0.5) * 360 / numBins - 90) * Math.PI / 180;
        ctx.fillStyle = interpolateSinebow((2 * i % numBins) / numBins);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r * Math.sqrt(bins[i] / binMax), a0, a1, false);
        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();
}

function analyzeLine(bins, ruler, line, isTwoWay) {
    for (var i = 0; i < line.length - 1; i++) {
        var bearing = ruler.bearing(line[i], line[i + 1]);
        var distance = ruler.distance(line[i], line[i + 1]);

        var k0 = Math.round((bearing + 360) * numBins / 360) % numBins; // main bin
        var k1 = Math.round((bearing + 180) * numBins / 360) % numBins; // opposite bin

        bins[k0] += distance;
        if (isTwoWay) bins[k1] += distance;
    }
}

// rainbow colors for the chart http://basecase.org/env/on-rainbows
function interpolateSinebow(t) {
    t = 0.5 - t;
    var r = Math.floor(250 * Math.pow(Math.sin(Math.PI * (t + 0 / 3)), 2));
    var g = Math.floor(250 * Math.pow(Math.sin(Math.PI * (t + 1 / 3)), 2));
    var b = Math.floor(250 * Math.pow(Math.sin(Math.PI * (t + 2 / 3)), 2));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
}

map.on('load', function () {
    updateOrientations();
    // update the chart on moveend; we could do that on move,
    // but this is slow on some zoom levels due to a huge amount of roads
    map.on('moveend', updateOrientations);
});
