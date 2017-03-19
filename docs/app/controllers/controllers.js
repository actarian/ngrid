/* global angular, app */

app.controller('DemoCtrl', ['$scope', '$filter', '$http', '$timeout', 'State', function($scope, $filter, $http, $timeout, State) {
    var state = $scope.state = new State();

    var today = new Date();
    today.setHours(0);
    today.setMinutes(0);
    $scope.getDate = function(index, row, col) {
        if (index !== undefined) {
            // console.log('calendar', row, col, index);
            var adate = new Date(today.getTime());
            adate.setDate(adate.getDate() + col);
            if (row === 0) {
                return $filter('date')(adate, 'EEE d MMM yy');
            } else {
                adate.setMinutes(row * 5);
                return $filter('date')(adate, 'hh:mm');
            }
        }
    }

    var options = $scope.options = {};
    function serialNumber(number, max) {
        return new Array((1 + (max.toString().length) - (number.toString().length))).join('0');
    }

    function Cols() {
        var COLS = 1000;
        var cols = [];
        while (cols.length < COLS) {
            var id = cols.length + 1;
            cols.push({
                $id: id,
                id: id,
                // name: 'C' + serialNumber(id, COLS) + id,
                name: 'C' + id,
            });
        }
        console.log(cols[0]);
        $scope.cols = cols;
    }

    function Rows() {
        var ROWS = 24 * (60/5) + 1;
        var rows = [];
        while (rows.length < ROWS) {
            var id = rows.length + 1;
            rows.push({
                $id: id,
                id: id,
                // name: 'R' + serialNumber(id, ROWS) + id,
                name: 'R' + id,
            });
        }
        console.log(rows[0]);
        $scope.rows = rows;
    }

    Rows();

    Cols();

    /*
    $timeout(function() {
        var rows = $scope.rows;
        var id = rows.length + 1;
        rows.push({
            $id: id,
            id: id,
            // name: 'R' + serialNumber(id, ROWS) + id,
            name: 'R' + id,
        });
    }, 3000);
    */

}]);