import React from 'react';
import { Input, PageHeader, Row, Col, Card, Checkbox, Select, Icon, Tooltip, message } from 'antd';
import { useRef } from 'react';
import crossfilter from 'crossfilter';
import { useState } from 'react';
import { useEffect } from 'react';
import { Chart, registerShape, Util } from '@antv/g2';
import { isEmpty, max } from 'lodash';
import DataSet from '@antv/data-set';
import * as d3 from "d3";
import * as dc from "dc";
import _ from 'lodash';
import { quantileSeq, arg } from "mathjs"

import * as MapController from '../../map/MapController';
import './StaticMainContainer.scss';

// import data from './data.json';
import TweetsStatistics from '../RealTimeContainer/TweetsStatistics';
import TwitterService from '../../services/TwitterService';

const { Option } = Select

const maxWords = 50;
const wordsColors = ["#646464", "#818181", "#a2a2a2", "#ffffff"]

const formatFunctions = {
    minutes: d3.timeMinute,
    seconds: d3.timeSecond,
    hour: d3.timeHour,
    day: d3.timeDay,
    identity: x => x
}

export function StaticMainContainer({ onBack }) {

    const [data, setData] = useState();
    const [offline, setOffline] = useState()

    const [selectedKeys, setSelectedKeys] = useState([])
    const keyFilter = t => selectedKeys.length === 0 || selectedKeys.includes(t.key)

    const [selectedTypes, setSelectedTypes] = useState([])
    const typeFilter = t => selectedTypes.length === 0 || selectedTypes.includes(t.type)

    const [dateInterval, setDateInterval] = useState()
    const dateFilter = t => !dateInterval || (t.date.getTime() >= dateInterval[0] && t.date.getTime() <= dateInterval[1])

    const wordChart = useRef()

    const [barChart, setBarChart] = useState()
    const [pieChart, setPieChart] = useState()

    const filteredData = (data || [])
        .filter(keyFilter)
        .filter(typeFilter)
        .filter(dateFilter)

    const colors = ["#3366cc", "#dc3912", "#ff9900", "#109618", "#990099", "#0099c6", "#dd4477", "#66aa00", "#b82e2e", "#316395", "#994499", "#22aa99", "#aaaa11", "#6633cc", "#e67300", "#8b0707", "#651067", "#329262", "#5574a6", "#3b3eac"]

    const [statistics, setStatistics] = useState({});
    const metrics = useRef({ users: new Set() })
    const [coloredKeys, setColors] = useState([]);

    const [dateFormater, setDateFormater] = useState(() => formatFunctions.identity)
    const dateFormatSelect = <Select disabled={dateInterval} defaultValue={"identity"} onChange={f => setDateFormater(() => formatFunctions[f])}>
        <Option key={0} value="identity">Momento exato</Option>
        <Option key={1} value="seconds">Segundos</Option>
        <Option key={2} value="minutes">Minutos</Option>
        <Option key={3} value="hour">Hora</Option>
        <Option key={4} value="day">Dia</Option>
    </Select>

    const warningTooltip = <Tooltip title="AVISO: enquanto o zoom está ativo, outros gráficos não conseguem aplicar seus filtros a este">
        <Icon type="warning" />
    </Tooltip>

    const clearZoomButton = <Tooltip title="Remover zoom">

        <Icon onClick={_ => setDateInterval()} className="white-icon" type="zoom-out" />

    </Tooltip >


    const [globalFacts, setGlobalFacts] = useState()

    function getTweetType(tweet) {
        if (tweet.retweet) return "Retweet"
        else if (tweet.reply) return "Resposta"
        else return "Original"
    }

    function processData(data) {
        data.forEach(d => {
            d.date = new Date(parseInt(d.date.$numberLong))
            d.type = getTweetType(d)
        });

        // data.sort((a, b) => b..$numberLong - a.date)
        // console.log(data)
        setData(addColorToData(data))
    }

    useEffect(() => {
        /** Backend's Request to get historical tweets*/
        TwitterService.find().then(data => {
            setOffline(false)
            processData(data)
        })
            .catch(_ => {
                setOffline(true)
                message.warning("Não foi possível se comunicar com o servidor. Carregando conjunto de dados exemplo")
                TwitterService.getStaticData().then(processData)
            })
    }, [])


    useEffect(() => {
        if (data) init();
    }, [data])

    useEffect(() => {
        const seriecChart = drawSeriesChart()

        if (seriecChart) seriecChart.render()
        // drawBarChart(facts).render()
        // drawSunburst(facts).render()

    }, [dateFormater])

    useEffect(() => {
        if (globalFacts) {
            clearFilters()
            drawSeriesChart().render()
            drawBarChart().render()
            drawSunburst().render()

            dc.renderAll()
        }
    }, [globalFacts])

    useEffect(() => {

        if (dateInterval) {
            clearFilters()
            const newFacts = crossfilter(data.filter(dateFilter))
            drawBarChart(newFacts).render()
            drawSunburst(newFacts).render()
        }
        else {
            const factsData = (data || [])
            const facts = crossfilter(factsData)
            setGlobalFacts(facts)
        }


    }, [dateInterval])

    useEffect(() => {
        MapController.clearMarkers()
        if (!isEmpty(data)) {

            if (barChart)
                barChart.on('filtered.monitor', (_, type) => {
                    if (selectedKeys.includes(type))
                        setSelectedKeys(selectedKeys.filter(k => k !== type))
                    else setSelectedKeys([...selectedKeys, type])
                });
            if (pieChart)
                pieChart.on('filtered.monitor', (_, type) => {
                    if (selectedTypes.includes(type))
                        setSelectedTypes(selectedTypes.filter(k => k !== type))
                    else setSelectedTypes([...selectedTypes, type])
                });

            drawWordChart();
            addMarkers();
        }
        // draw()
    }, [selectedKeys, selectedTypes, dateInterval])

    //** Initializations */
    function init() {
        MapController.createMap("map");
        draw();
    }

    // function updateAreaFilter(e, idDimension) {
    //     const visible = new Set()

    //     data.forEach(d => {
    //         if(!d.position) visible.add
    //     })

    //     MapController.getMarkersLayer().eachLayer(marker => {
    //         if (e.target.getBounds().contains(marker.getLatLng()))
    //             visible.add(marker.id)
    //     })

    //     console.log(visible)

    //     idDimension.filterFunction(id => visible.has(id))
    // }

    function clearFilters() {
        setSelectedKeys([])
        setSelectedTypes([])
    }

    function draw() {
        if (data) {
            const factsData = (data || [])
            const facts = crossfilter(factsData)
            setGlobalFacts(facts)

            // const idDimension = facts.dimension(d => d.id)


            // MapController.getMap()
            //     .on('moveend', e => updateAreaFilter(e, idDimension))

            // drawBarChart();
            // drawSeriesChart();
            configStats();
            addMarkers();
            drawWordChart();
            // drawSunburst();

            // dc.renderAll()
        }

    }

    /**
     * 
     * ###########  Draw Charts  ###########
     * 
    */

    /** Word Cloud */
    function drawWordChart() {

        const dv = configWorldCloud();
        if (!dv) return
        const [min, max] = dv.range('value');

        const colorRange = d3.scaleQuantize()

            .domain(quantileSeq(dv.rows.map(d => d.value), [0, 0.33, 0.66, 1]))
            .range(wordsColors)

        if (wordChart.current) {
            wordChart.current.destroy()
        }

        const chart = new Chart({
            container: 'word-cloud',
            autoFit: true,
            height: 300,
            padding: 0
        });

        chart.data(dv.rows);
        chart.scale({
            x: { nice: false },
            y: { nice: false }
        });
        chart.legend(false);
        chart.axis(false);
        chart.tooltip({
            showTitle: false,
            showMarkers: false
        });
        chart.coordinate().reflect();
        chart.point()
            .position('x*y')
            .color('value', v => {

                return colorRange(v)
            })
            .shape('cloud');
        chart.render();

        wordChart.current = chart
    }

    function configWorldCloud() {
        const wc = getWordCount()
        if (isEmpty(wc))
            return
        const dv = new DataSet.View().source(wc);

        const [min, max] = dv.range('value');
        dv.transform({
            spiral: 'rectangular',
            type: 'tag-cloud',
            fields: ['key', 'value'],
            font: 'serif',
            size: [600, 300],
            padding: 0,
            timeInterval: Infinity,
            rotate() {
                let random = ~~(Math.random() * 4) % 4;
                if (random === 2) {
                    random = 0;
                }
                return random * 90; // 0, 90, 270
            },
            fontSize(d) {
                const [minFont, maxFont] = [24, 80]
                const size = ((d.value - min) / (max - min)) * (maxFont - minFont) + minFont
                return size;
            }
        });
        return dv;
    }

    /** Bar Chart */
    function drawBarChart(facts = globalFacts) {
        if (!facts) return
        const keyDimension = facts.dimension(d => d.key)
        const keyCountGroup = keyDimension.group()

        const visibleKeys = keyCountGroup.all().map(d => d.key)
        const keyScale = d3.scaleOrdinal().domain(visibleKeys)

        const chart = dc.barChart(d3.select("#bar"))
        chart
            .width(600)
            .height(300)
            .dimension(keyDimension)
            .xUnits(dc.units.ordinal)
            .margins({ top: 10, right: 20, bottom: 50, left: 50 })
            .x(keyScale)
            .colors(k => coloredKeys[k])
            .colorAccessor(d => d.key)
            // .centerBar(true)
            .gap(50)
            .renderHorizontalGridLines(true)
            .group(keyCountGroup)
            .renderlet(function (chart) {
                // console.log(chart.selectAll("g.x text").size())
                chart.selectAll("g.x text")
                    // .attr('dx', '-30')
                    // .attr('transform', "rotate(-45)");
                    .text(k => {
                        const maxChars = 45;
                        let n = chart.selectAll("g.x text").size()
                        if (n <= 3) return k
                        else {
                            const charsByKey = Math.min(12, maxChars / n)
                            // console.log(n, maxChars, charsByKey)
                            if (charsByKey <= 3) return "..."
                            else {
                                if (k.length <= charsByKey) return k
                                return k.slice(0, charsByKey - 3) + "..."
                            }
                        }


                    })

            });

        chart.on('filtered.monitor', (_, type) => {
            if (selectedKeys.includes(type))
                setSelectedKeys(selectedKeys.filter(k => k !== type))
            else setSelectedKeys([...selectedKeys, type])
        });

        chart.xAxis().ticks(4)

        setBarChart(chart)
        return chart;

    }

    /** Series Chart */
    function drawSeriesChart(facts = globalFacts) {
        if (!facts) return
        const timeDimension = facts.dimension(d => [d.key, dateFormater(d.date)])
        const timeCountGroup = timeDimension.group()

        // const rangeTimeDimension = facts.dimension(d => [d.key, dateFormater(d.date)])
        // const rangeTimeCountGroup = rangeTimeDimension.group()

        const [minDate, maxDate] = d3.extent(data || [], d => dateFormater(d.date))

        const timeScale = d3
            .scaleTime()
            .domain([minDate, maxDate])


        // const rangeTimeScale = d3
        //     .scaleTime()
        //     .domain([d3.min(data || [], d => dateFormater(d.date)), d3.max(data || [], d => dateFormater(d.date))])

        const dateSeriesChart = new dc.SeriesChart(d3.select("#series"));
        // const rangeChart = new dc.SeriesChart(d3.select("#series-range"));

        dateSeriesChart
            .width(1200)
            .height(400)
            .chart(function (c) { return new dc.LineChart(c); })
            .x(timeScale)
            .margins({ top: 80, right: 10, bottom: 40, left: 40 })
            .brushOn(false)
            .yAxisLabel("Quantidade de Tweets")
            .xAxisLabel("Horário")
            .clipPadding(10)
            .elasticY(true)
            .dimension(timeDimension)
            .group(timeCountGroup)
            .mouseZoomable(true)
            .ordering(d => d.key[1])

            // .rangeChart(rangeChart)
            .seriesAccessor(function (d) { return d.key[0]; })
            .keyAccessor(function (d) { return d.key[1]; })
            .valueAccessor(function (d) { return +d.value; })
            .legend(dc.legend().x(80).y(0).itemHeight(13).autoItemWidth(true).horizontal(1))
            .colors(k => coloredKeys[k])
            .colorAccessor(d => d.key[0]);

        dateSeriesChart.on("filtered.monitor", (e, dateInterval) => {
            if (isEmpty(dateInterval)) setDateInterval()
            else {
                if (dateInterval[0].getTime() === minDate.getTime() && dateInterval[1].getTime() === maxDate.getTime())
                    setDateInterval()
                else setDateInterval(dateInterval)
            }
        })



        // rangeChart
        //     .width(1200)
        //     .height(300)
        //     .chart(function (c) { return new dc.LineChart(c).curve(d3.curveCardinal) })
        //     .x(rangeTimeScale)
        //     .margins({ top: 10, right: 10, bottom: 50, left: 80 })
        //     .brushOn(true)
        //     .mouseZoomable(true)
        //     .yAxisLabel("Quantidade de Tweets")
        //     .xAxisLabel("Horário")
        //     .clipPadding(10)
        //     .elasticY(true)
        //     .dimension(timeDimension)
        //     .group(timeCountGroup)
        //     .seriesAccessor(function (d) { return d.key[0]; })
        //     .keyAccessor(function (d) { return d.key[1]; })
        //     .valueAccessor(function (d) { return +d.value; })
        //     // .legend(dc.legend().x(80).y(284).itemHeight(13).autoItemWidth(true).horizontal(1))
        //     .colors(k => coloredKeys[k])
        //     .colorAccessor(d => d.key[0]);

        // rangeChart.xAxis().ticks(4)


        return dateSeriesChart

    }

    function drawSunburst(facts = globalFacts) {
        if (!facts) return
        const typesDimension = facts.dimension(d => d.type)
        const typesCountGroup = typesDimension.group()

        const colorScale = d3.scaleOrdinal()
            .domain(["Resposta", "Retweet", "Original"])
            .range(["#46EDC8", "#374D7C", "#FDF289"])

        var chart = dc.pieChart(d3.select("#sunburst"));
        chart.width(600)
            .height(295)
            .innerRadius(0)
            .dimension(typesDimension)
            .group(typesCountGroup)
            .colors(colorScale)
            .colorAccessor(d => d.key)
            .legend(dc.legend())

        chart.on('filtered.monitor', (_, type) => {
            if (selectedTypes.includes(type))
                setSelectedTypes(selectedTypes.filter(k => k !== type))
            else setSelectedTypes([...selectedTypes, type])
        });

        setPieChart(chart)
        return chart
    }


    /**
     * 
     * ###########  Processing Data  ###########
     * 
    */

    /** Satistics */
    function configStats() {
        metrics.current = { users: new Set() }

        data.forEach(tweet => {
            if (tweet.retweet) metrics.current.retweets = (metrics.current.retweets || 0) + 1
            else if (tweet.reply) metrics.current.replies = (metrics.current.replies || 0) + 1
            else metrics.current.original = (metrics.current.original || 0) + 1

            metrics.current.users.add(tweet.userName);
            if (tweet.position) metrics.current.geolocated = (metrics.current.geolocated || 0) + 1
            metrics.current.mediasAndLink = (metrics.current.mediasAndLink || 0) + tweet.mediasAndLink
            metrics.current.mentions = (metrics.current.mentions || 0) + tweet.mentions
            metrics.current.total = (metrics.current.total || 0) + 1
        })

        setStatistics({
            users: metrics.current.users.size,
            retweets: (metrics.current.retweets || 0),
            mediaAndLinks: metrics.current.mediasAndLink,
            total: metrics.current.total,
            mentions: metrics.current.mentions,
            geolocated: metrics.current.geolocated,
            replies: metrics.current.replies,
            originals: metrics.current.original
        })
    }

    /**
     * 
     * ###########  Auxiliary Functions  ###########
     * 
    */

    function getTextAttrs(cfg) {
        return {
            ...cfg.defaultStyle,
            ...cfg.style,
            fontSize: cfg.data.size,
            text: cfg.data.text,
            textAlign: 'center',
            fontFamily: cfg.data.font,
            fill: cfg.color || cfg.defaultStyle.stroke,
            textBaseline: 'Alphabetic'
        };
    }

    registerShape('point', 'cloud', {
        draw(cfg, container) {
            const attrs = getTextAttrs(cfg);
            const textShape = container.addShape('text', {
                attrs: {
                    ...attrs,
                    x: cfg.x,
                    y: cfg.y
                }
            });
            if (cfg.data.rotate) {
                Util.rotate(textShape, cfg.data.rotate * Math.PI / 180);
            }

            return textShape;
        }
    });



    function addColorToData(data) {
        const keyColor = {
            // retweet: "white",
            // reply: "magenta",
            // original: "black"
        }
        let i = 0

        const newData = data.map(t => {
            if (keyColor[t.key]) return { ...t, color: keyColor[t.key] }
            else {
                if (i > colors.length - 1) return t
                keyColor[t.key] = colors[i]
                i += 1
                return { ...t, color: keyColor[t.key] }
            }
        }).filter(t => t.color)

        setColors(keyColor);
        return newData
    }


    /** Add markers to map */
    function addMarkers() {
        filteredData
            .forEach(function (tweet) {
                tweet.date = new Date(tweet.date);
                MapController.addMarker(tweet, _, true);
            });
    }

    function getWordCount() {
        const wc = {}

        filteredData.forEach(({ wordCount }) => {
            Object.entries(wordCount).map(([word, count]) => wc[word] = count + (wc[word] || 0))
        })

        const wordCount = Object.entries(wc)
            .map(([key, value]) => ({ key, value }))

        wordCount.sort((a, b) => b.value - a.value)

        if (wordCount.length <= maxWords) return wordCount
        else return wordCount.slice(0, maxWords)
    }


    /** Render */
    return (
        <div className="main-container">
            <PageHeader
                title="Tweets Analyzer"
                subTitle="Análise histórica dos tweets consumidos"
                onBack={onBack}
                backIcon={offline ? false : <Icon type="arrow-left" />}
            >
                {/* <CheckboxGroup options={Object.keys(coloredKeys)} value={selectedKeys} onChange={setSelectedKeys} /> */}
            </PageHeader>
            <Card title="Métricas" bordered={false}>
                <TweetsStatistics statistics={statistics} selectable={false} />
            </Card>

            <br />
            <Row>
                <Card title={<>
                    Contagem temporal {dateInterval && <> {warningTooltip} {clearZoomButton} </>}
                </>}
                    bordered={false} extra={dateFormatSelect}>
                    <div className="static-series-container">
                        <div id="series"></div>

                        <div id="series-range"></div>
                    </div>
                </Card>
            </Row>
            <br />
            <Row gutter={[16, 16]}>
                <Col span={12}>
                    <Card title="Localização" bordered={false}>
                        <div className="map-container">
                            <div id="map"></div>
                        </div >
                    </Card>


                </Col>
                <Col span={12}>
                    <Card title="Contagem total" bordered={false}>
                        <div className="static-bars-container">
                            <div id="bar"></div>
                        </div>
                    </Card>
                </Col>
            </Row>
            <br />

            <Row gutter={[16, 16]}>
                <Col span={12}>
                    <Card title="Contagem por tipo" bordered={false}>
                        <div className="static-sunburst-container">
                            <div id="sunburst"></div>
                        </div>
                    </Card>
                </Col>
                <Col span={12}>
                    <Card title="Palavras mais utilizadas" bordered={false}>
                        <div className="word-cloud-container">
                            <div id="word-cloud"></div>
                        </div>
                    </Card>


                </Col>

            </Row>
            <br />

            <Row>

            </Row>
        </div>
    );
}