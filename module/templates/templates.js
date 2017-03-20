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