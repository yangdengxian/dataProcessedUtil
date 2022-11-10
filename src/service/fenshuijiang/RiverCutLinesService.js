//模式名称
var schema = "fenshuijiang";

const RiverCutLinesService = {
    queryAllLinesData(client) {
        return client.query(`select *,st_asgeojson(geom) as lineGeoJSON from ${schema}.rivercutlines;`, [], function (err, result) {

            if (err) {

                return console.error('查询出错', err);

            }

            return result;

        });
    }
};

module.exports = RiverCutLinesService;