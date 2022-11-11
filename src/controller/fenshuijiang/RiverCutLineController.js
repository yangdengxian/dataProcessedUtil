const express = require("express");
const router = express.Router();
const dataBaseConfig = require("../../config/database");
const pg = require('pg');
const FileUtil = require('../../utils/FileUtil');

// 创建连接池

const pool = new pg.Pool(dataBaseConfig);
//模式名称
const schema = "fenshuijiang";

//河流横截线geojson
const riverLinesGeoJSON = {
    type: "FeatureCollection",
    name: "riverLinesGeoJSON",
    crs: {
        type: "name",
        properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" }
    },
    features: []
};


router.get('/createRiverLines', function (req, res, next) {
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

            lines.forEach((line, index) => {
                (function (index) {
                    //多线
                    const lineGeoJSON = JSON.parse(line["linegeojson"]);
                    const linesCoords = lineGeoJSON["coordinates"][0];
                    const entityname = line["entityname"];
                    //带高程的坐标点
                    let lineCoordsZ = [];
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
                                const elevation = (+point["elevation"]).toFixed(1);
                                const pointGeoJSON = JSON.parse(point["pointgeojson"]);
                                //多点
                                const pointCoord = pointGeoJSON["coordinates"][0];

                                if (coord[0] == pointCoord[0] && coord[1] == pointCoord[1]) {
                                    lineCoordsZ.push([
                                        coord[0],
                                        coord[1],
                                        +((+elevation).toFixed(1))
                                    ]);
                                    break;
                                }
                            }
                        }

                        //面闭合
                        riverLinesGeoJSON["features"].push({
                            "type": "Feature",
                            "properties": Object.assign(line, {
                                linelength: +((+(line["shape_leng"])).toFixed(1)),
                                linescoords: JSON.stringify(lineCoordsZ),
                            }),
                            "geometry": lineGeoJSON
                        });


                        if (index == lines.length - 1) {
                            FileUtil.writeFile('./public/data/riverLinesGeoJSON.geojson', riverLinesGeoJSON, function (e) {
                                if (e) {
                                    return console.error(e);
                                }
                                res.json(riverLinesGeoJSON);
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
