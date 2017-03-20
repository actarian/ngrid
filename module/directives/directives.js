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