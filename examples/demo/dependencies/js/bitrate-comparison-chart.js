function ComparisonChart(canvasContext, maxLength, customConfig) {
    var timestamp = new Date().valueOf();

    this.maxChartLength = maxLength ? maxLength : 10;
    var chartConfig = customConfig ? customConfig : getDefaultChartConfig(timestamp);
    this.bitrateComparisonChart = new Chart(canvasContext, chartConfig);

    this.updateChart = function (clientBitrate, serverBitrate) {
        var timestamp = new Date().valueOf();

        this.removeOldData();
        this.bitrateComparisonChart.config.data.datasets[0].data.push(chartData(timestamp, serverBitrate));
        this.bitrateComparisonChart.config.data.datasets[1].data.push(chartData(timestamp, clientBitrate));
        this.bitrateComparisonChart.update();
    };

    this.removeOldData = function () {
        if (this.bitrateComparisonChart.config.data.datasets[0].data.length > this.maxChartLength) {
            this.bitrateComparisonChart.config.data.datasets[0].data.splice(0, 1);
            this.bitrateComparisonChart.config.data.datasets[1].data.splice(0, 1);
        }
    };

    this.clearBitrateChart = function () {
        var timestamp = new Date().valueOf();
        this.bitrateComparisonChart.config.data.datasets[0].data = getChartStartData(timestamp);
        this.bitrateComparisonChart.config.data.datasets[1].data = getChartStartData(timestamp);
        this.bitrateComparisonChart.update();
    };
}


function getChartStartData(currentTime) {
    var data = [];
    data.push({
        t: currentTime,
        y: 0
    });
    return data;
}

function chartData(currentTime, value) {
    return {
        t: currentTime,
        y: value
    };
}

function getDefaultChartConfig(timestamp) {
    var color = Chart.helpers.color;
    var redColor = 'rgb(255, 99, 132)';
    var greenColor = 'rgb(75, 192, 192)';
    var cc = {
        data: {
            datasets: [{
                label: 'Server bitrate',
                backgroundColor: color(redColor).alpha(0.5).rgbString(),
                borderColor: redColor,
                type: 'line',
                data: getChartStartData(timestamp),
                pointRadius: 0,
                fill: false,
                lineTension: 0,
                borderWidth: 2
            }, {
                label: 'Client bitrate',
                backgroundColor: color(greenColor).alpha(0.5).rgbString(),
                borderColor: greenColor,
                type: 'line',
                pointRadius: 0,
                data: getChartStartData(timestamp),
                fill: false,
                lineTension: 0,
                borderWidth: 2
            }]
        },
        options: {
            animation: {
                duration: 0
            },
            maintainAspectRatio: false,
            responsive: false,
            scales: {
                xAxes: [{
                    type: 'time',
                    distribution: 'series',
                    offset: true,
                    ticks: {
                        major: {
                            enabled: true,
                            fontStyle: 'bold'
                        },
                        source: 'data',
                        autoSkip: true,
                        autoSkipPadding: 75,
                        maxRotation: 0,
                        sampleSize: 100
                    },
                    afterBuildTicks: function (scale, ticks) {
                        var majorUnit = scale._majorUnit;
                        var firstTick = ticks[0];
                        var i, ilen, val, tick, currMajor, lastMajor;

                        val = moment(ticks[0].value);
                        if ((majorUnit === 'minute' && val.second() === 0)
                            || (majorUnit === 'hour' && val.minute() === 0)
                            || (majorUnit === 'day' && val.hour() === 9)
                            || (majorUnit === 'month' && val.date() <= 3 && val.isoWeekday() === 1)
                            || (majorUnit === 'year' && val.month() === 0)) {
                            firstTick.major = true;
                        } else {
                            firstTick.major = false;
                        }
                        lastMajor = val.get(majorUnit);

                        for (i = 1, ilen = ticks.length; i < ilen; i++) {
                            tick = ticks[i];
                            val = moment(tick.value);
                            currMajor = val.get(majorUnit);
                            tick.major = currMajor !== lastMajor;
                            lastMajor = currMajor;
                        }
                        return ticks;
                    }
                }],
                yAxes: [{
                    gridLines: {
                        drawBorder: false
                    },
                    scaleLabel: {
                        display: true,
                        labelString: 'Bitrate comparison'
                    },
                    ticks: {
                        beginAtZero:true
                    }
                }]
            },
            tooltips: {
                intersect: false,
                mode: 'index',
                callbacks: {
                    label: function (tooltipItem, myData) {
                        var label = myData.datasets[tooltipItem.datasetIndex].label || '';
                        if (label) {
                            label += ': ';
                        }
                        label += parseFloat(tooltipItem.value).toFixed(2);
                        return label;
                    }
                }
            }
        }
    };
    return cc;
}