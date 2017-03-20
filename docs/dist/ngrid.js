
(function(window, angular) {'use strict';

/* global angular */

var module = angular.module('ngrid', ['ng', 'ngSanitize']);

/* global angular, module */

window.console ? null : window.console = { log: function () { } };

module.constant('ngridModes', {
    SUM: 1,
    MIN: 2,
    MAX: 3,
    AVG: 4,
});

/* global angular, module */

/* global angular, module */

module.directive('ngrid', ['$window', '$templateCache', '$templateRequest', '$interpolate', '$compile', '$filter', '$timeout', 'Utils', function ($window, $templateCache, $templateRequest, $interpolate, $compile, $filter, $timeout, Utils) {
    // polyfill for trim >= IE9
    function trimWhiteSpace(string) {
        return string.replace(/^\s+|\s+$/gm, '');
    }
    return {
        priority: 1,
        restrict: 'A',
        replace: true,
        /*
        // with scope attributes watch won't work anymore
        scope: {},
        */
        templateUrl: 'ngrid/partials/ngrid',
        transclude: true,
        controller: ['$transclude', '$attrs', function ($transclude, $attrs) {
            $transclude(function (clone, scope) {
                var html = Array.prototype.slice.call(clone).filter(function (node) {
                    // remove empty text nodes
                    return (node.nodeType !== 3 || /\S/.test(node.nodeValue));
                }).map(function (node) {
                    return trimWhiteSpace(node.outerHTML);
                });
                html = html.join('');
                $attrs.template = html;
            });
        }],
        link: function (scope, element, attributes, model, transclude) {
            var CALENDAR_SIZE = 365;
            var CALENDAR = attributes.ngridCalendar !== undefined;
            if (CALENDAR) {
                element.addClass('calendar');
            }

            // console.log(attributes);
            var template = attributes.template;
            attributes.template = null;
            // console.log('template', template);

            var templateMonth = '<div class="ngrid-month"><span class="monthName" ng-bind="$monthName"></span> <span class="year" ng-bind="$year"></span></div>';
            var templateWeek = '<div class="ngrid-week">W <span class="weekName" ng-bind="$weekName"></span></div>';
            var templateDay = '<div class="ngrid-day" ng-class="{ weekend: $weekEnd }"><span class="dayName" ng-bind="$dayName"></span><span class="day" ng-bind="$day"></span></div>';

            var nodeElement = element[0],
                nodeHeader = nodeElement.querySelector('.ngrid-header'),
                nodeHeaderInner = nodeElement.querySelector('.ngrid-header>.ngrid-inner'),
                nodeHeaderMonths = nodeElement.querySelector('.ngrid-header>.ngrid-inner>.ngrid-months'),
                nodeHeaderWeeks = nodeElement.querySelector('.ngrid-header>.ngrid-inner>.ngrid-weeks'),
                nodeHeaderDays = nodeElement.querySelector('.ngrid-header>.ngrid-inner>.ngrid-days'),
                nodeTable = nodeElement.querySelector('.ngrid-table'),
                nodeTableInner = nodeElement.querySelector('.ngrid-table>.ngrid-inner'),
                nodeSpacer = nodeElement.querySelector('.ngrid-spacer'),
                nodeInfo = nodeElement.querySelector('.ngrid-info'),
                monthsElement = angular.element(nodeHeaderMonths),
                weeksElement = angular.element(nodeHeaderWeeks),
                daysElement = angular.element(nodeHeaderDays),
                tableElement = angular.element(nodeTableInner),
                layout = scope.layout = {
                    grid: { width: 0, height: 0 },
                    table: { x: 0, y: 0, width: 0, height: 0 },
                    scroll: { x: 0, y: 0 },
                    rows: {}, cols: {},
                    visibleMonths: [], visibleWeeks: [], visibleDays: [], visibles: [],
                    cell: {
                        width: attributes.cellWidth !== undefined ? parseInt(attributes.cellWidth) : 40,
                        height: attributes.cellHeight !== undefined ? parseInt(attributes.cellHeight) : 40,
                    },
                    month: {
                        width: attributes.monthWidth !== undefined ? parseInt(attributes.monthWidth) : 40,
                        height: attributes.monthHeight !== undefined ? parseInt(attributes.monthHeight) : 25,
                    },
                    week: {
                        width: attributes.weekWidth !== undefined ? parseInt(attributes.weekWidth) : 40,
                        height: attributes.weekHeight !== undefined ? parseInt(attributes.weekHeight) : 25,
                    },
                    day: {
                        width: attributes.dayWidth !== undefined ? parseInt(attributes.dayWidth) : 40,
                        height: attributes.dayHeight !== undefined ? parseInt(attributes.dayHeight) : 40,
                    }
                },
                rows, cols, weeks, months;

            function updateRows() {
                var total = layout.rows.total,
                    dirty = false, from, to, count;
                if (total > 0) {
                    count = Math.ceil(layout.grid.height / layout.cell.height) + 1;
                    from = Math.floor(layout.scroll.y / layout.cell.height);
                    from = Math.max(0, Math.min(total - count + 1, from));
                    to = Math.min(rows.length, from + count);
                } else {
                    count = to = 1;
                    from = 0;
                }
                dirty = (from !== layout.rows.from) || (to !== layout.rows.to);
                layout.rows.dirty = dirty;
                layout.rows.from = from;
                layout.rows.to = to;
                layout.rows.count = count;
            }

            function updateCols() {
                var total = layout.cols.total,
                    dirty = false, from, to, count;
                if (total > 0) {
                    count = Math.ceil(layout.grid.width / layout.cell.width) + 1;
                    from = Math.floor(layout.scroll.x / layout.cell.width);
                    from = Math.max(0, Math.min(total - count + 1, from));
                    to = Math.min(cols.length, from + count);
                } else {
                    count = to = 1;
                    from = 0;
                }
                dirty = (from !== layout.cols.from) || (to !== layout.cols.to);
                layout.cols.dirty = dirty;
                layout.cols.from = from;
                layout.cols.to = to;
                layout.cols.count = count;
            }

            function getCell(i, item) {
                var r = Math.floor(i / layout.cols.count);
                var c = (i % layout.cols.count);
                var $row = layout.rows.from + r;
                var $col = layout.cols.from + c;
                var $index = $row * layout.cols.total + $col;
                var $scope = item ? item.scope : scope.$new();
                $scope.$i = i;
                $scope.$r = r;
                $scope.$c = c;
                $scope.$index = $index;
                $scope.$row = $row;
                $scope.$col = $col;
                $scope.row = rows ? rows[$row] : null;
                $scope.col = cols ? cols[$col] : null;
                return $scope;
            }

            function drawCells() {
                // console.log('drawCells', template);
                var count = layout.rows.count * layout.cols.count,
                    visibles = layout.visibles,
                    targetElement = tableElement;
                if (layout.rows.dirty || layout.cols.dirty) {
                    angular.forEach(visibles, function (item, i) {
                        if (i < count) {
                            var $scope = getCell(i, item);
                            if (!$scope.$$phase) {
                                $scope.$digest();
                            }
                        }
                    });
                    // console.log('dirty', Math.min(visibles.length, count));
                }
                while (visibles.length < count) {
                    var $scope = getCell(visibles.length);
                    var compiled = $compile(template)($scope, function (cloned) {
                        compiled = cloned;
                    });
                    var $element = angular.element(compiled);
                    targetElement.append($element);
                    visibles.push({
                        element: $element,
                        scope: $scope,
                    });
                }
            }

            var today = new Date();
            today.setHours(0);
            today.setMinutes(0);
            today.setSeconds(0);
            var offset = today.getTimezoneOffset() * 60 * 1000;
            var oneday = 24 * 60 * 60 * 1000;
            function getDate(col) {
                if (col !== undefined) {
                    var adate = new Date(today.getTime());
                    adate.setDate(adate.getDate() - CALENDAR_SIZE + col);
                    return adate;
                }
            }

            function getDay(i, item) {
                var $c = i;
                var $col = layout.cols.from + $c;
                var $index = $col;
                var $scope = item ? item.scope : scope.$new();
                $scope.$c = $c;
                $scope.$col = $col;
                $scope.$index = $index;
                var adate = getDate($col), day = adate.getDay();
                $scope.$key = Math.round(adate.getTime() / oneday) * oneday; // + offset;
                $scope.$date = adate;
                $scope.$day = $filter('date')(adate, 'd');
                $scope.$dayName = $filter('date')(adate, 'EEE');
                $scope.$week = $filter('date')(adate, 'ww');
                $scope.$workingDay = (day > 0 && day < 6);
                $scope.$weekEnd = !$scope.$workingDay;
                $scope.$month = $filter('date')(adate, 'MM');
                $scope.$monthName = $filter('date')(adate, 'MMM');
                $scope.$year = $filter('date')(adate, 'yy');
                return $scope;
            }
            
            function getAbsoluteCol(col) {
                // console.log('getAbsoluteCol', col);
                var i = col - layout.cols.from;
                var item = layout.visibleDays[i];
                return getDay(i, item);
            }

            function getWeek(i, week, item) {
                var $scope = item ? item.scope : scope.$new();                
                $scope.$week = week.week;
                $scope.$weekName = week.weekName;
                $scope.$from = week.from;
                $scope.$to = week.to;
                return $scope;
            }

            function getMonth(i, month, item) {
                var $scope = item ? item.scope : scope.$new();
                $scope.$month = month.month;
                $scope.$monthName = month.monthName;
                $scope.$year = month.year;
                $scope.$from = month.from;
                $scope.$to = month.to;
                return $scope;
            }

            function drawHeaders() {
                // console.log('drawCells', template);
                if (CALENDAR) {
                    var count = layout.cols.count,
                        visibleMonths = layout.visibleMonths,
                        visibleWeeks = layout.visibleWeeks,
                        visibleDays = layout.visibleDays;
                    if (layout.cols.dirty) {
                        angular.forEach(visibleDays, function (item, i) {
                            if (i < count) {
                                var $scope = getDay(i, item);
                                if (!$scope.$$phase) {
                                    $scope.$digest();
                                }
                            }
                        });
                        // console.log('dirty', Math.min(visibles.length, count));
                    }
                    while (visibleDays.length < count) {
                        var $scope = getDay(visibleDays.length);
                        var compiled = $compile(templateDay)($scope, function (cloned) {
                            compiled = cloned;
                        });
                        var $element = angular.element(compiled);
                        daysElement.append($element);
                        visibleDays.push({
                            element: $element,
                            scope: $scope,
                        });
                    }
                    weeks = [];
                    months = [];
                    var lastWeek = null, lastMonth = null;
                    angular.forEach(visibleDays, function (day, i) {
                        if (i < count) {
                            var week = parseInt(day.scope.$week);
                            if (week !== lastWeek) {
                                if (weeks.length) {
                                    weeks[weeks.length - 1].to = i;
                                }
                                weeks.push({
                                    week: week,
                                    weekName: day.scope.$week,
                                    from: i,
                                    to: i,
                                });
                                lastWeek = week;
                            }
                            var month = parseInt(day.scope.$month);
                            if (month !== lastMonth) {
                                if (months.length) {
                                    months[months.length - 1].to = i;
                                }
                                months.push({
                                    month: month,
                                    monthName: day.scope.$monthName,
                                    year: day.scope.$year,
                                    from: i,
                                    to: i,
                                });
                                lastMonth = month;
                            }
                        }
                    });
                    if (weeks.length > 0) {
                        weeks[weeks.length - 1].to = count;
                    }
                    if (months.length > 0) {
                        months[months.length - 1].to = count;
                    }
                    if (layout.cols.dirty) {
                        angular.forEach(visibleWeeks, function (item, i) {
                            if (i < weeks.length) {
                                var $scope = getWeek(i, weeks[i], item);
                                if (!$scope.$$phase) {
                                    $scope.$digest();
                                }
                            }
                        });
                        while (visibleWeeks.length < weeks.length) {
                            var $scope = getWeek(visibleWeeks.length, weeks[visibleWeeks.length]);
                            var compiled = $compile(templateWeek)($scope, function (cloned) {
                                compiled = cloned;
                            });
                            var $element = angular.element(compiled);
                            weeksElement.append($element);
                            visibleWeeks.push({
                                element: $element,
                                scope: $scope,
                            });
                        }
                        angular.forEach(visibleMonths, function (item, i) {
                            if (i < months.length) {
                                var $scope = getMonth(i, months[i], item);
                                if (!$scope.$$phase) {
                                    $scope.$digest();
                                }
                            }
                        });
                        while (visibleMonths.length < months.length) {
                            var $scope = getMonth(visibleMonths.length, months[visibleMonths.length]);
                            var compiled = $compile(templateMonth)($scope, function (cloned) {
                                compiled = cloned;
                            });
                            var $element = angular.element(compiled);
                            monthsElement.append($element);
                            visibleMonths.push({
                                element: $element,
                                scope: $scope,
                            });
                        }
                    }
                }
            }

            function update() {
                // console.log('update');
                updateRows();
                updateCols();
                drawCells();
                drawHeaders();
                render();
                redraw();
            }

            function render() {
                var count = layout.rows.count * layout.cols.count,
                    visibles = layout.visibles;
                var USE_TRANSFORM = true;
                angular.forEach(visibles, function (item, i) {
                    var node = item.element[0];
                    if (i < count) {
                        node.style.width = (cols ? layout.cell.width : layout.table.width) + 'px';
                        node.style.height = (rows ? layout.cell.height : layout.table.height) + 'px';
                        var r = item.scope.$r;
                        var c = item.scope.$c;
                        if (USE_TRANSFORM) {
                            transform(node, 'translateX(' + (c * layout.cell.width) + 'px) translateY(' + (r * layout.cell.height) + 'px)');
                        } else {
                            node.style.left = (c * layout.cell.width) + 'px';
                            node.style.top = (r * layout.cell.height) + 'px';
                            node.style.visibility = 'visible';
                        }
                    } else {
                        if (USE_TRANSFORM) {
                            transform(node, 'translateX(-1000px) translateY(-1000px)');
                        } else {
                            node.style.left = '0px';
                            node.style.top = '0px';
                            node.style.visibility = 'hidden';
                        }
                    }
                });                
                if (CALENDAR) {
                    var mx = 0, wx = 0;
                    angular.forEach(layout.visibleMonths, function (item, i) {
                        var node = item.element[0];
                        var width = Math.max(1, item.scope.$to - item.scope.$from) * layout.day.width;
                        if (i < months.length) {
                            node.style.width = width + 'px';
                            node.style.height = layout.month.height + 'px';
                            transform(node, 'translateX(' + mx + 'px) translateY(0px)');
                            mx += width;
                        } else {
                            transform(node, 'translateX(-1000px) translateY(-1000px)');
                        }
                    });
                    angular.forEach(layout.visibleWeeks, function (item, i) {
                        var node = item.element[0];
                        var width = Math.max(1, item.scope.$to - item.scope.$from) * layout.day.width;
                        if (i < weeks.length) {
                            node.style.width = width + 'px';
                            node.style.height = layout.week.height + 'px';
                            transform(node, 'translateX(' + wx + 'px) translateY(' + layout.month.height + 'px)');
                            wx += width;
                        } else {
                            transform(node, 'translateX(-1000px) translateY(-1000px)');
                        }
                    });
                    angular.forEach(layout.visibleDays, function (item, i) {
                        var node = item.element[0];
                        if (i < layout.cols.count) {
                            node.style.width = (cols ? layout.day.width : layout.day.width) + 'px';
                            node.style.height = (rows ? layout.day.height : layout.day.height) + 'px';
                            var c = item.scope.$c;
                            transform(node, 'translateX(' + (c * layout.day.width) + 'px) translateY(' + (layout.month.height + layout.week.height) + 'px)');
                        } else {
                            transform(node, 'translateX(-1000px) translateY(-1000px)');
                        }
                    });
                }
            }

            function redraw() {
                layout.table.x = Math.floor(layout.scroll.x / layout.cell.width) * layout.cell.width;
                layout.table.y = Math.floor(layout.scroll.y / layout.cell.height) * layout.cell.height;
                nodeTableInner.style.width = (layout.cols.has ? layout.cell.width * layout.cols.count : layout.grid.width) + 'px';
                nodeTableInner.style.height = (layout.rows.has ? layout.cell.height * layout.rows.count : layout.grid.height) + 'px';
                transform(nodeTableInner, 'translateX(' + layout.table.x + 'px) translateY(' + layout.table.y + 'px)');
                if (CALENDAR) {
                    var headerX = layout.table.x - layout.scroll.x;
                    transform(nodeHeaderInner, 'translateX(' + headerX + 'px)');
                }
                log({
                    scroll: layout.scroll,
                    grid: layout.grid,
                    rows: layout.rows.has ? layout.rows : null,
                    cols: layout.cols.has ? layout.cols : null,
                });
            }

            function transform(node, value) {
                node.style.WebkitTransform =
                    node.style.MozTransform =
                    node.style.OTransform =
                    node.style.MsTransform =
                    node.style.transform =
                    value;
            }

            function onRows() {
                layout.rows.total = 0;
                layout.table.height = 0;
                if (rows) {
                    layout.rows.total = rows.length;
                    layout.table.height = layout.rows.total * layout.cell.height;
                    layout.rows.has = true;
                } else {
                    layout.table.height = layout.grid.height;
                    layout.rows.has = false;
                }
                if (rows && rows.length) {
                    element.addClass('vertical');
                } else {
                    element.removeClass('vertical');
                }
                nodeSpacer.style.height = layout.table.height + 'px';
            }

            function onCols() {
                layout.cols.total = 0;
                layout.table.width = 0;
                if (cols) {
                    layout.cols.total = cols.length;
                    layout.table.width = layout.cols.total * layout.cell.width;
                    layout.cols.has = false;
                } else {
                    layout.table.width = layout.grid.width;
                    layout.cols.has = false;
                }
                if (cols && cols.length) {
                    element.addClass('horizontal');
                } else {
                    element.removeClass('horizontal');
                }
                nodeSpacer.style.width = layout.table.width + 'px';
            }

            function scrollToColumn(col) {
                resize();
                nodeTable.scrollLeft = (col * layout.cell.width);
                // console.log('scrollToColumn', (layout.table.width - layout.grid.width), nodeTable.scrollLeft);
                doScroll();
            }

            function scrollToX(x) {
                nodeTable.scrollLeft = x;
                // console.log('scrollTo');
                doScroll();
            }
            function scrollToY(y) {
                nodeTable.scrollTop = y;
                // console.log('scrollTo');
                doScroll();
            }
            function scrollTo($layout) {
                nodeTable.scrollLeft = $layout.scroll.x;
                nodeTable.scrollTop = $layout.scroll.y;
                // console.log('scrollTo');
                doScroll();
            }

            function doScroll() {
                if (rows) {
                    layout.rows.total = rows.length;
                    layout.table.height = layout.rows.total * layout.cell.height;
                } else {
                    layout.table.height = layout.grid.height;
                }
                if (cols) {
                    layout.cols.total = cols.length;
                    layout.table.width = layout.cols.total * layout.cell.width;
                } else {
                    layout.table.width = layout.grid.width;
                }
                layout.scroll.x = Math.max(0, Math.min((layout.table.width - layout.grid.width), nodeTable.scrollLeft));
                layout.scroll.y = Math.max(0, Math.min((layout.table.height - layout.grid.height), nodeTable.scrollTop));
                // console.log(layout.scroll.x, layout.scroll.y, layout.table.width, layout.grid.width);
                // console.log('doScroll', (layout.table.width - layout.grid.width), nodeTable.scrollLeft);
                update();
            }

            function onScroll() {
                doScroll();
                // console.log('ngrid.doScroll');
                if (angular.isFunction(layout.onScroll)) {
                    layout.onScroll(layout);
                }
            }

            function resize() {
                var WW = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
                var WH = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
                layout.grid.width = layout.table.width = Math.min(nodeTable.offsetWidth, WW);
                layout.grid.height = layout.table.height = Math.min(nodeTable.offsetHeight, WH);
            }
            // resize fires on window resize and on scope update      
            function onResize() {
                resize();
                update();
            }

            function log(obj) {
                layout.info = JSON.stringify(obj);
                nodeInfo.innerHTML = layout.info;
            }

            var down, move, diff, dragging, sx, sy;

            function onStart(e) {
                down = Utils.getTouch(e);
                sx = nodeTable.scrollLeft;
                sy = nodeTable.scrollTop;
                addDragListeners();
                return false;
            }

            function onMove(e) {
                move = Utils.getTouch(e);
                diff = down.difference(move);
                if (!dragging && diff.power() > 25) {
                    dragging = true;
                    element.addClass('dragging');
                }
                if (dragging) {
                    nodeTable.scrollLeft = sx - diff.x;
                    // nodeTable.scrollTop = sy - diff.y;
                    onScroll();
                }
                return false;
            }

            function onEnd(e) {
                if (dragging) {
                    dragging = false;
                    element.removeClass('dragging');
                }
                removeDragListeners();
                return false;
            }

            function addDragListeners() {
                angular.element($window).on('touchmove mousemove', onMove);
                angular.element($window).on('touchend mouseup', onEnd);
            };

            function removeDragListeners() {
                angular.element($window).off('touchmove mousemove', onMove);
                angular.element($window).off('touchend mouseup', onEnd);
            };

            function addListeners() {
                angular.element(nodeHeader).on('touchstart mousedown', onStart);
                angular.element(nodeTable).on('scroll', onScroll);
                angular.element($window).on('resize', onResize);
            };

            function removeListeners() {
                angular.element(nodeHeader).off('touchstart mousedown', onStart);
                angular.element(nodeTable).off('scroll', onScroll);
                angular.element($window).off('resize', onResize);
            };
            scope.$on('$destroy', function () {
                removeListeners();
                removeDragListeners();
            });
            addListeners();

            // WATCH ROWS
            scope.$watchCollection(attributes.ngridRows, function (value, oldValue) {
                // console.log('ngrid.$watchCollection.ngridRows');
                rows = value;
                onRows();
                onResize();
            });

            // WATCH COLS
            if (CALENDAR) {
                cols = new Array(CALENDAR_SIZE * 2);
                onCols();
                setTimeout(function () {
                    scrollToColumn(CALENDAR_SIZE);
                });
            } else {
                scope.$watch(attributes.ngridCols, function (value) {
                    // console.log('ngrid.$watchCollection.ngridCols');
                    cols = value;
                    onCols();
                    onResize();
                });
            }

            // WATCH OPTIONS
            scope.$watch(attributes.ngrid, function (value) {
                if (angular.isObject(value)) {
                    // ok but add a schema (keys)
                    layout.scrollTo = scrollTo;
                    layout.scrollToX = scrollToX;
                    layout.scrollToY = scrollToY;
                    var keys = ['onScroll', 'scrollTo', 'scrollToX', 'scrollToY'];
                    angular.forEach(keys, function (key) {
                        layout[key] = value[key] || layout[key];
                        value[key] = value[key] || layout[key];
                        if (CALENDAR) {
                            value.getAbsoluteCol = getAbsoluteCol;
                        }
                    });
                    // angular.extend(layout, value);
                    onResize();
                    // console.log('ngrid.$watch.ngrid', layout);
                }
            });
        }
    }
}]);
/* global angular, module */

module.filter('shortName', ['$filter', function ($filter) {
    function toTitleCase(str) {
        return str.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
    }
    return function (value) {
        if (!value) {
            return '';
        }
        if (value.indexOf(' .') === value.length - 2) {
            value = value.split(' .').join('');
        }
        /*
        var splitted;
        if (value.indexOf('.') !== -1) {
            splitted = value.split('.');
        } else {
            splitted = value.split(' ');
        }
        */
        var splitted = value.split(' ');
        var firstName = splitted.shift();
        if (splitted.length) {
            var lastName = splitted.join(' ');
            return firstName.substr(0, 1).toUpperCase() + '.' + toTitleCase(lastName);
        } else {
            return firstName;
        }
    }
}]);

module.filter('customCurrency', ['$filter', function ($filter) {
    var legacyFilter = $filter('currency');
    return function (cost, currency) {
        return legacyFilter(cost * currency.ratio, currency.formatting);
    }
}]);

module.filter('customNumber', ['$filter', function ($filter) {
    var filter = $filter('number');
    return function (value, precision, unit) {
        unit = unit || '';
        return (value ? filter(value, precision) + unit : '-');
    }
}]);

module.filter('customHours', [function () {
    return function (value) {
        if (value) {
            var hours = Math.floor(value);
            var minutes = Math.floor((value - hours) * 60);
            var label = hours ? hours + ' H' : '';
            label += minutes ? ' ' + minutes + ' m' : '';
            return label;
        } else {
            return '-';
        }
    }
}]);

module.filter('customDate', ['$filter', function ($filter) {
    var filter = $filter('date');
    return function (value, format, timezone) {
        return value ? filter(value, format, timezone) : '-';
    }
}]);

module.filter('customTime', ['$filter', function ($filter) {
    return function (value, placeholder) {
        if (value) {
            return Utils.parseTime(value);
        } else {
            return (placeholder ? placeholder : '-');
        }
    }
}]);

module.filter('customDigital', ['$filter', function ($filter) {
    return function (value, placeholder) {
        if (value) {
            return Utils.parseHour(value);
        } else {
            return (placeholder ? placeholder : '-');
        }
    }
}]);

module.filter('customString', ['$filter', function ($filter) {
    return function (value, placeholder) {
        return value ? value : (placeholder ? placeholder : '-');
    }
}]);

module.filter('customEnum', function () {
    return function (val) {
        val = val + 1;
        return val < 10 ? '0' + val : val;
    };
});

/* global angular, module */

module.factory('Md5', [function () {

    var hex_chr = '0123456789abcdef'.split('');

    function cycle(x, k) {
        var a = x[0], b = x[1], c = x[2], d = x[3];

        a = ff(a, b, c, d, k[0], 7, -680876936);
        d = ff(d, a, b, c, k[1], 12, -389564586);
        c = ff(c, d, a, b, k[2], 17, 606105819);
        b = ff(b, c, d, a, k[3], 22, -1044525330);
        a = ff(a, b, c, d, k[4], 7, -176418897);
        d = ff(d, a, b, c, k[5], 12, 1200080426);
        c = ff(c, d, a, b, k[6], 17, -1473231341);
        b = ff(b, c, d, a, k[7], 22, -45705983);
        a = ff(a, b, c, d, k[8], 7, 1770035416);
        d = ff(d, a, b, c, k[9], 12, -1958414417);
        c = ff(c, d, a, b, k[10], 17, -42063);
        b = ff(b, c, d, a, k[11], 22, -1990404162);
        a = ff(a, b, c, d, k[12], 7, 1804603682);
        d = ff(d, a, b, c, k[13], 12, -40341101);
        c = ff(c, d, a, b, k[14], 17, -1502002290);
        b = ff(b, c, d, a, k[15], 22, 1236535329);

        a = gg(a, b, c, d, k[1], 5, -165796510);
        d = gg(d, a, b, c, k[6], 9, -1069501632);
        c = gg(c, d, a, b, k[11], 14, 643717713);
        b = gg(b, c, d, a, k[0], 20, -373897302);
        a = gg(a, b, c, d, k[5], 5, -701558691);
        d = gg(d, a, b, c, k[10], 9, 38016083);
        c = gg(c, d, a, b, k[15], 14, -660478335);
        b = gg(b, c, d, a, k[4], 20, -405537848);
        a = gg(a, b, c, d, k[9], 5, 568446438);
        d = gg(d, a, b, c, k[14], 9, -1019803690);
        c = gg(c, d, a, b, k[3], 14, -187363961);
        b = gg(b, c, d, a, k[8], 20, 1163531501);
        a = gg(a, b, c, d, k[13], 5, -1444681467);
        d = gg(d, a, b, c, k[2], 9, -51403784);
        c = gg(c, d, a, b, k[7], 14, 1735328473);
        b = gg(b, c, d, a, k[12], 20, -1926607734);

        a = hh(a, b, c, d, k[5], 4, -378558);
        d = hh(d, a, b, c, k[8], 11, -2022574463);
        c = hh(c, d, a, b, k[11], 16, 1839030562);
        b = hh(b, c, d, a, k[14], 23, -35309556);
        a = hh(a, b, c, d, k[1], 4, -1530992060);
        d = hh(d, a, b, c, k[4], 11, 1272893353);
        c = hh(c, d, a, b, k[7], 16, -155497632);
        b = hh(b, c, d, a, k[10], 23, -1094730640);
        a = hh(a, b, c, d, k[13], 4, 681279174);
        d = hh(d, a, b, c, k[0], 11, -358537222);
        c = hh(c, d, a, b, k[3], 16, -722521979);
        b = hh(b, c, d, a, k[6], 23, 76029189);
        a = hh(a, b, c, d, k[9], 4, -640364487);
        d = hh(d, a, b, c, k[12], 11, -421815835);
        c = hh(c, d, a, b, k[15], 16, 530742520);
        b = hh(b, c, d, a, k[2], 23, -995338651);

        a = ii(a, b, c, d, k[0], 6, -198630844);
        d = ii(d, a, b, c, k[7], 10, 1126891415);
        c = ii(c, d, a, b, k[14], 15, -1416354905);
        b = ii(b, c, d, a, k[5], 21, -57434055);
        a = ii(a, b, c, d, k[12], 6, 1700485571);
        d = ii(d, a, b, c, k[3], 10, -1894986606);
        c = ii(c, d, a, b, k[10], 15, -1051523);
        b = ii(b, c, d, a, k[1], 21, -2054922799);
        a = ii(a, b, c, d, k[8], 6, 1873313359);
        d = ii(d, a, b, c, k[15], 10, -30611744);
        c = ii(c, d, a, b, k[6], 15, -1560198380);
        b = ii(b, c, d, a, k[13], 21, 1309151649);
        a = ii(a, b, c, d, k[4], 6, -145523070);
        d = ii(d, a, b, c, k[11], 10, -1120210379);
        c = ii(c, d, a, b, k[2], 15, 718787259);
        b = ii(b, c, d, a, k[9], 21, -343485551);

        x[0] = add32(a, x[0]);
        x[1] = add32(b, x[1]);
        x[2] = add32(c, x[2]);
        x[3] = add32(d, x[3]);

    }

    function cmn(q, a, b, x, s, t) {
        a = add32(add32(a, q), add32(x, t));
        return add32((a << s) | (a >>> (32 - s)), b);
    }

    function ff(a, b, c, d, x, s, t) {
        return cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }

    function gg(a, b, c, d, x, s, t) {
        return cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }

    function hh(a, b, c, d, x, s, t) {
        return cmn(b ^ c ^ d, a, b, x, s, t);
    }

    function ii(a, b, c, d, x, s, t) {
        return cmn(c ^ (b | (~d)), a, b, x, s, t);
    }

    function md51(s) {
        var txt = '';
        var n = s.length,
        state = [1732584193, -271733879, -1732584194, 271733878], i;
        for (i = 64; i <= s.length; i += 64) {
            cycle(state, md5blk(s.substring(i - 64, i)));
        }
        s = s.substring(i - 64);
        var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (i = 0; i < s.length; i++)
            tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) {
            cycle(state, tail);
            for (i = 0; i < 16; i++) tail[i] = 0;
        }
        tail[14] = n * 8;
        cycle(state, tail);
        return state;
    }

    /* there needs to be support for Unicode here,
        * unless we pretend that we can redefine the MD-5
        * algorithm for multi-byte characters (perhaps
        * by adding every four 16-bit characters and
        * shortening the sum to 32 bits). Otherwise
        * I suggest performing MD-5 as if every character
        * was two bytes--e.g., 0040 0025 = @%--but then
        * how will an ordinary MD-5 sum be matched?
        * There is no way to standardize text to something
        * like UTF-8 before transformation; speed cost is
        * utterly prohibitive. The JavaScript standard
        * itself needs to look at this: it should start
        * providing access to strings as preformed UTF-8
        * 8-bit unsigned value arrays.
        */
    function md5blk(s) { /* I figured global was faster.   */
        var md5blks = [], i; /* Andy King said do it this way. */
        for (i = 0; i < 64; i += 4) {
            md5blks[i >> 2] = s.charCodeAt(i)
            + (s.charCodeAt(i + 1) << 8)
            + (s.charCodeAt(i + 2) << 16)
            + (s.charCodeAt(i + 3) << 24);
        }
        return md5blks;
    }

    function rhex(n) {
        var s = '', j = 0;
        for (; j < 4; j++)
            s += hex_chr[(n >> (j * 8 + 4)) & 0x0F]
            + hex_chr[(n >> (j * 8)) & 0x0F];
        return s;
    }

    function hex(x) {
        for (var i = 0; i < x.length; i++)
            x[i] = rhex(x[i]);
        return x.join('');
    }

    /* this function is much faster,
    so if possible we use it. Some IEs
    are the only ones I know of that
    need the idiotic second function,
    generated by an if clause.  */
    function add32(a, b) {
        return (a + b) & 0xFFFFFFFF;
    }

    function Md5() { }
    Md5.encode = function (string) {
        return hex(md51(string));
    }
    if (Md5.encode('hello') !== '5d41402abc4b2a76b9719d911017c592') {
        add32 = function (x, y) {
            var lsw = (x & 0xFFFF) + (y & 0xFFFF),
            msw = (x >> 16) + (y >> 16) + (lsw >> 16);
            return (msw << 16) | (lsw & 0xFFFF);
        }
    }
    return Md5;
}]);

module.factory('Utils', ['$compile', '$controller', 'Vector', 'Md5', function ($compile, $controller, Vector, Md5) {
    (function () {
        // POLYFILL window.requestAnimationFrame
        var lastTime = 0;
        var vendors = ['ms', 'moz', 'webkit', 'o'];
        for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
            window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
            window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame']
                                       || window[vendors[x] + 'CancelRequestAnimationFrame'];
        }
        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = function (callback, element) {
                var currTime = new Date().getTime();
                var timeToCall = Math.max(0, 16 - (currTime - lastTime));
                var id = window.setTimeout(function () { callback(currTime + timeToCall); }, timeToCall);
                lastTime = currTime + timeToCall;
                return id;
            };
        }
        if (!window.cancelAnimationFrame) {
            window.cancelAnimationFrame = function (id) {
                clearTimeout(id);
            };
        }
    }());
    (function () {
        // POLYFILL Array.prototype.reduce
        // Production steps of ECMA-262, Edition 5, 15.4.4.21
        // Reference: http://es5.github.io/#x15.4.4.21
        // https://tc39.github.io/ecma262/#sec-array.prototype.reduce
        if (!Array.prototype.reduce) {
            Object.defineProperty(Array.prototype, 'reduce', {
                value: function (callback) {// , initialvalue
                    if (this === null) {
                        throw new TypeError('Array.prototype.reduce called on null or undefined');
                    }
                    if (typeof callback !== 'function') {
                        throw new TypeError(callback + ' is not a function');
                    }
                    var o = Object(this);
                    var len = o.length >>> 0;
                    var k = 0;
                    var value;
                    if (arguments.length == 2) {
                        value = arguments[1];
                    } else {
                        while (k < len && !(k in o)) {
                            k++;
                        }
                        if (k >= len) {
                            throw new TypeError('Reduce of empty array with no initial value');
                        }
                        value = o[k++];
                    }
                    while (k < len) {
                        if (k in o) {
                            value = callback(value, o[k], k, o);
                        }
                        k++;
                    }
                    return value;
                }
            });
        }
    }());
    var _isTouch;
    function isTouch() {
        if (!_isTouch) {
            _isTouch = {
                value: ('ontouchstart' in window || 'onmsgesturechange' in window)
            }
        }
        // console.log(_isTouch);
        return _isTouch.value;
    }
    function getTouch(e, previous) {
        var t = new Vector();
        if (e.type == 'touchstart' || e.type == 'touchmove' || e.type == 'touchend' || e.type == 'touchcancel') {
            var touch = null;
            var event = e.originalEvent ? e.originalEvent : e;
            var touches = event.touches.length ? event.touches : event.changedTouches;
            if (touches && touches.length) {
                touch = touches[0];
            }
            if (touch) {
                t.x = touch.pageX;
                t.y = touch.pageY;
            }
        } else if (e.type == 'click' || e.type == 'mousedown' || e.type == 'mouseup' || e.type == 'mousemove' || e.type == 'mouseover' || e.type == 'mouseout' || e.type == 'mouseenter' || e.type == 'mouseleave') {
            t.x = e.pageX;
            t.y = e.pageY;
        }
        if (previous) {
            t.s = Vector.difference(previous, t);
        }
        t.type = e.type;
        return t;
    }
    function getRelativeTouch(element, point) {
        var rect = element[0].getBoundingClientRect();
        var e = new Vector(rect.left, rect.top);
        return Vector.difference(e, point);
    }
    function getClosest(el, selector) {
        var matchesFn, parent;
        ['matches', 'webkitMatchesSelector', 'mozMatchesSelector', 'msMatchesSelector', 'oMatchesSelector'].some(function (fn) {
            if (typeof document.body[fn] == 'function') {
                matchesFn = fn;
                return true;
            }
            return false;
        });
        if (el[matchesFn](selector)) {
            return el;
        }
        while (el !== null) {
            parent = el.parentElement;
            if (parent !== null && parent[matchesFn](selector)) {
                return parent;
            }
            el = parent;
        }
        return null;
    }
    function getClosestElement(el, target) {
        var matchesFn, parent;
        if (el === target) {
            return el;
        }
        while (el !== null) {
            parent = el.parentElement;
            if (parent !== null && parent === target) {
                return parent;
            }
            el = parent;
        }
        return null;
    }
    var getNow = Date.now || function () {
        return new Date().getTime();
    };
    function throttle(func, wait, options) {
        // Returns a function, that, when invoked, will only be triggered at most once
        // during a given window of time. Normally, the throttled function will run
        // as much as it can, without ever going more than once per `wait` duration;
        // but if you'd like to disable the execution on the leading edge, pass
        // `{leading: false}`. To disable execution on the trailing edge, ditto.
        var context, args, result;
        var timeout = null;
        var previous = 0;
        if (!options) options = {};
        var later = function () {
            previous = options.leading === false ? 0 : getNow();
            timeout = null;
            result = func.apply(context, args);
            if (!timeout) context = args = null;
        };
        return function () {
            var now = getNow();
            if (!previous && options.leading === false) previous = now;
            var remaining = wait - (now - previous);
            context = this;
            args = arguments;
            if (remaining <= 0 || remaining > wait) {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                previous = now;
                result = func.apply(context, args);
                if (!timeout) context = args = null;
            } else if (!timeout && options.trailing !== false) {
                timeout = setTimeout(later, remaining);
            }
            return result;
        };
    }
    function where(array, query) {
        var found = null;
        if (array) {
            angular.forEach(array, function (item) {
                var has = true;
                angular.forEach(query, function (value, key) {
                    has = has && item[key] === value;
                });
                if (has) {
                    found = item;
                }
            });
        }
        return found;
    }
    function compileController(scope, element, html, data) {
        // console.log('Utils.compileController', element);
        element.html(html);
        var link = $compile(element.contents());
        if (data.controller) {
            var $scope = scope.$new();
            angular.extend($scope, data);
            var controller = $controller(data.controller, { $scope: $scope });
            if (data.controllerAs) {
                scope[data.controllerAs] = controller;
            }
            element.data('$ngControllerController', controller);
            element.children().data('$ngControllerController', controller);
            scope = $scope;
        }
        link(scope);
    }
    var ua = window.navigator.userAgent.toLowerCase();
    var safari = ua.indexOf('safari') !== -1 && ua.indexOf('chrome') === -1;
    var msie = ua.indexOf('trident') !== -1 || ua.indexOf('edge') !== -1 || ua.indexOf('msie') !== -1;
    var chrome = !safari && !msie && ua.indexOf('chrome') !== -1;
    var mobile = ua.indexOf('mobile') !== -1;
    function Utils() {
    }
    function reverseSortOn(key) {
        return function (a, b) {
            if (a[key] < b[key]) {
                return 1;
            }
            if (a[key] > b[key]) {
                return -1;
            }
            // a must be equal to b
            return 0;
        }
    }
    function format(string, prepend, expression) {
        string = string || '';
        prepend = prepend || '';
        var splitted = string.split(',');
        if (splitted.length > 1) {
            var formatted = splitted.shift();
            angular.forEach(splitted, function (value, index) {
                if (expression) {
                    formatted = formatted.split('{' + index + '}').join('\' + ' + prepend + value + ' + \'');
                } else {
                    formatted = formatted.split('{' + index + '}').join(prepend + value);
                }
            });
            if (expression) {
                return '\'' + formatted + '\'';
            } else {
                return formatted;
            }
        } else {
            return prepend + string;
        }
    }
    function reducer(o, key) {
        return o[key];
    }
    function reducerSetter(o, key, value) {
        if (typeof key == 'string') {
            return reducerSetter(o, key.split('.'), value);
        } else if (key.length == 1 && value !== undefined) {
            return o[key[0]] = value;
        } else if (key.length == 0) {
            return o;
        } else {
            return reducerSetter(o[key[0]], key.slice(1), value);
        }
    }
    function reducerAdder(o, key, value) {
        if (typeof key == 'string') {
            return reducerAdder(o, key.split('.'), value);
        } else if (key.length == 1 && value !== undefined) {
            return (o[key[0]] += value);
        } else if (key.length == 0) {
            return o;
        } else {
            return reducerAdder(o[key[0]], key.slice(1), value);
        }
    }
    Utils.reverseSortOn = reverseSortOn;
    Utils.getTouch = getTouch;
    Utils.getRelativeTouch = getRelativeTouch;
    Utils.getClosest = getClosest;
    Utils.getClosestElement = getClosestElement;
    Utils.throttle = throttle;
    Utils.where = where;
    Utils.format = format;
    Utils.compileController = compileController;
    Utils.reducer = reducer;
    Utils.reducerSetter = reducerSetter;
    Utils.reducerAdder = reducerAdder;
    Utils.toMd5 = function (string) {
        return Md5.encode(string);
    };
    Utils.ua = {
        safari: safari,
        msie: msie,
        chrome: chrome,
        mobile: mobile,
    };
    angular.forEach(Utils.ua, function (value, key) {
        if (value) {
            angular.element(document.getElementsByTagName('body')).addClass(key);
        }
    });
    return Utils;
}]);

module.factory('Vector', function () {
    function Vector(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }
    Vector.make = function (a, b) {
        return new Vector(b.x - a.x, b.y - a.y);
    };
    Vector.size = function (a) {
        return Math.sqrt(a.x * a.x + a.y * a.y);
    };
    Vector.normalize = function (a) {
        var l = Vector.size(a);
        a.x /= l;
        a.y /= l;
        return a;
    };
    Vector.incidence = function (a, b) {
        var angle = Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x);
        // if (angle < 0) angle += 2 * Math.PI;
        // angle = Math.min(angle, (Math.PI * 2 - angle));
        return angle;
    };
    Vector.distance = function (a, b) {
        return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
    };
    Vector.cross = function (a, b) {
        return (a.x * b.y) - (a.y * b.x);
    };
    Vector.difference = function (a, b) {
        return new Vector(b.x - a.x, b.y - a.y);
    };
    Vector.power = function (a, b) {
        var x = Math.abs(b.x - a.x);
        var y = Math.abs(b.y - a.y);
        return (x + y) / 2;
    };
    Vector.prototype = {
        size: function () {
            return Vector.size(this);
        },
        normalize: function () {
            return Vector.normalize(this);
        },
        incidence: function (b) {
            return Vector.incidence(this, b);
        },
        cross: function (b) {
            return Vector.cross(this, b);
        },
        distance: function (b) {
            return Vector.distance(this, b);
        },
        difference: function (b) {
            return Vector.difference(this, b);
        },
        power: function () {
            return (Math.abs(this.x) + Math.abs(this.y)) / 2;
        },
        towards: function (b, friction) {
            friction = friction || 0.125;
            this.x += (b.x - this.x) * friction;
            this.y += (b.y - this.y) * friction;
            return this;
        },
        add: function (b) {
            this.x += b.x;
            this.y += b.y;
            return this;
        },
        friction: function (b) {
            this.x *= b;
            this.y *= b;
            return this;
        },
        copy: function (b) {
            return new Vector(this.x, this.y);
        },
        toString: function () {
            return '{' + this.x + ',' + this.y + '}';
        },
    };
    return Vector;
});

/* global angular, module */

//HEAD 
(function(app) {
try { app = angular.module("ngrid"); }
catch(err) { app = angular.module("ngrid", []); }
app.run(["$templateCache", function($templateCache) {
"use strict";

$templateCache.put("ngrid/partials/ngrid","<div class=\"ngrid\">\n" +
    "    <div class=\"ngrid-header\">\n" +
    "        <div class=\"ngrid-inner\">\n" +
    "            <div class=\"ngrid-months\"></div>\n" +
    "            <div class=\"ngrid-weeks\"></div>\n" +
    "            <div class=\"ngrid-days\"></div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    <div class=\"ngrid-table\">\n" +
    "        <div class=\"ngrid-spacer\"></div>\n" +
    "        <div class=\"ngrid-inner\" ng-transclude></div>\n" +
    "    </div>\n" +
    "    <div class=\"ngrid-footer\"></div>\n" +
    "    <div class=\"ngrid-info\"></div>\n" +
    "</div>")
}]);
})();

})(window, window.angular);
