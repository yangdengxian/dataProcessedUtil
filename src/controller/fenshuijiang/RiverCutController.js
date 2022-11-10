const express = require("express");
const router = express.Router();
const dataBaseConfig = require("../../config/database");
const pg = require('pg');
const RiverCutLinesService = require("../../service/fenshuijiang/RiverCutLinesService");
const FileUtil = require('../../utils/FileUtil');
const { count } = require("console");

// 创建连接池

const pool = new pg.Pool(dataBaseConfig);
//模式名称
const schema = "fenshuijiang";

//河流横截面geojson
const cutPolygonGeoJSON = {
    type: "FeatureCollection",
    name: "cutPolygonGeoJSON",
    crs: {
        type: "name",
        properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" }
    },
    features: []
};


router.get('/queryData', function (req, res, next) {
    pool.connect(function (err, client, done) {
        if (err) {
            return console.error('数据库连接出错', err);

        }
        //查询线数据
        client.query(`select *,st_asgeojson(geom) as linegeojson, st_asgeojson(st_centroid(geom)) as center from ${schema}.rivercutlines;`, [], function (err, linesResult) {

            // done();// 释放连接（将其返回给连接池）

            if (err) {

                return console.error('查询出错', err);

            }

            const lines = linesResult.rows;
            // let lineCount = 0;

            lines.forEach((line,index) => {
                (function(index){
                    //多线
                    const lineGeoJSON = JSON.parse(line["linegeojson"]);
                    const lineCenterGeoJSON = JSON.parse(line["center"]);
                    const lineCenterCoords = lineCenterGeoJSON["coordinates"];
                    const linesCoords = lineGeoJSON["coordinates"][0];
                    const entityname = line["entityname"];
                    //带高程的坐标点
                    let cutPolygonCoordinates = [];
                    let lineCoordsE = [];
                    //求最大最小高程值
                    let maxElevation = 0;
                    let minElevation = 0; 
                    //查询对应点数据
                    client.query(`select elevation, st_asgeojson(geom) as pointgeojson from ${schema}.rivercutpoints where entityname = '${entityname}';`, [], function (err, pointsResut) {
                        if (err) {

                            return console.error('查询出错', err);

                        }

                        const points = pointsResut.rows;

                        if (!points.length) return;

                        console.log(index);
                        console.log(entityname);

                        //点对比
                        for (let i = 0; i < linesCoords.length; i++) {
                            const coord = linesCoords[i];
                            for (let j = 0; j < points.length; j++) {
                                const point = points[j];
                                const elevation = (+point["elevation"]).toFixed(2);
                                const pointGeoJSON = JSON.parse(point["pointgeojson"]);
                                //多点
                                const pointCoord = pointGeoJSON["coordinates"][0];
    
                                if (coord[0] == pointCoord[0] && coord[1] == pointCoord[1]) {
                                    // coord[2] = +elevation;
                                    //拔高45米
                                    coord[2] = +elevation + 45;
                                    coord[2] = +(+coord[2].toFixed(2));
                                    //初始化最大最小值
                                    if (!maxElevation || !minElevation) {
                                        maxElevation = minElevation = coord[2];
                                    }
                                    maxElevation = Math.max(maxElevation, coord[2]);
                                    minElevation = Math.min(minElevation, coord[2]);
                                    cutPolygonCoordinates.push(coord);
                                    lineCoordsE.push(coord);
                                    break;
                                }
                            }
                        }
    
                        //js 反向 遍历数组
                        let len = cutPolygonCoordinates.length;
                        for (var i = len - 1; i >= 0; i--) {
                            var coord = [
                                cutPolygonCoordinates[i][0],
                                cutPolygonCoordinates[i][1],
                                +((minElevation - 7).toFixed(2))
                            ];
                            cutPolygonCoordinates.push(coord);
                        }
                        //面闭合
                        cutPolygonCoordinates.push(cutPolygonCoordinates[0]);
                        cutPolygonGeoJSON["features"].push({
                            "type": "Feature",
                            "properties": Object.assign(line,{
                                maxelevation: maxElevation,
                                minelevation: +((minElevation - 7).toFixed(2)),
                                linelength: +((+(line["shape_leng"])).toFixed(2)),
                                linescoords: JSON.stringify(lineCoordsE),
                                center: `${lineCenterCoords[0]},${lineCenterCoords[1]},${maxElevation}`,
                                //小心点位不对应
                                //横断面直线第一个点
                                dis_frompoints: `${linesCoords[0][0]},${linesCoords[0][1]},${+((minElevation - 7).toFixed(2))}`,
                                //横断面直线最后一个点
                                dis_topoints: `${linesCoords[linesCoords.length - 1][0]},${linesCoords[linesCoords.length - 1][1]},${+((minElevation - 7).toFixed(2))}`,
                                //横断面直线最首点上方点
                                elev_topoints: `${linesCoords[0][0]},${linesCoords[0][1]},${maxElevation}`,
                            }),
                            "geometry": {
                                "type": "Polygon",
                                "coordinates": [cutPolygonCoordinates]
                            }
                        });

                        /* if (lineCount == lines.length - 1) {
                            FileUtil.writeFile('./public/data/cutPolygonGeoJSON.geojson',cutPolygonGeoJSON,function(e){
                                if (e) {
                                    return console.error(e);
                                }
                                res.json(cutPolygonGeoJSON);
                                // done();// 释放连接（将其返回给连接池）
                                return console.log("写入成功");
                            })
                        } else {
                            lineCount++;
                        } */

                        if (index == lines.length - 1) {
                            FileUtil.writeFile('./public/data/cutPolygonGeoJSON.geojson',cutPolygonGeoJSON,function(e){
                                if (e) {
                                    return console.error(e);
                                }
                                res.json(cutPolygonGeoJSON);
                                done();// 释放连接（将其返回给连接池）
                                return console.log("写入成功");
                            })
                        }
                    });
                })(index);
            });

        });

    });
});


module.exports = router;
