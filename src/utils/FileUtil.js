const fs = require('fs');

const FileUtil = {
    writeFileRecursive(path, data, callback){
        let lastPath = path.substring(0, path.lastIndexOf("/"));
        fs.mkdir(lastPath, {recursive: true}, (err) => {
            if (err) return callback(err);
            fs.writeFile(path, data, function(err){
                if (err) return callback(err);
                return callback(null);
            });
        });
    },
    
    writeFile(path,data,callback) {
        if (!(typeof data == 'string')) {
            data = JSON.stringify(data);
        }
        this.writeFileRecursive(path,data,callback)
    }
};

module.exports = FileUtil;