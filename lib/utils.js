'use strict';

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _filter = require('lodash/filter');

var _filter2 = _interopRequireDefault(_filter);

var _invert = require('lodash/invert');

var _invert2 = _interopRequireDefault(_invert);

var _isEmpty = require('lodash/isEmpty');

var _isEmpty2 = _interopRequireDefault(_isEmpty);

var _mapValues = require('lodash/mapValues');

var _mapValues2 = _interopRequireDefault(_mapValues);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var PLACEHOLDERS = {
  id: "__id__",
  display: "__display__",
  type: "__type__"
};
var PLACEHOLDER_MARKUP_POSITIONS_CACHE = {};
var MARKUP_REGEX_CACHE = {};

var escapeMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;'
};
var createEscaper = function createEscaper(map) {
  var escaper = function escaper(match) {
    return map[match];
  };
  var keys = [];
  for (var key in map) {
    if (map.hasOwnProperty(key)) keys.push(key);
  }
  var source = '(?:' + keys.join('|') + ')';
  var testRegexp = RegExp(source);
  var replaceRegexp = RegExp(source, 'g');
  return function (string) {
    string = string == null ? '' : '' + string;
    return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
  };
};

module.exports = {

  escapeHtml: createEscaper(escapeMap),

  escapeRegex: function escapeRegex(str) {
    return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  },

  markupToRegex: function markupToRegex(markup, matchAtEnd) {
    var markupPattern = this.escapeRegex(markup);
    markupPattern = markupPattern.replace(PLACEHOLDERS.display, "(.+?)");
    markupPattern = markupPattern.replace(PLACEHOLDERS.id, "(.+?)");
    markupPattern = markupPattern.replace(PLACEHOLDERS.type, "(.+?)");
    if (matchAtEnd) {
      // append a $ to match at the end of the string
      markupPattern = markupPattern + "$";
    }
    return new RegExp(markupPattern, "g");
  },

  // cache provided regex, or get previously cached regex, or build and cache regex from provided markup
  useMarkupRegex: function useMarkupRegex(markup, regex) {
    var cache = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : MARKUP_REGEX_CACHE;

    // if (regex) console.log('mentions.regex', markup, regex, cache[markup]);
    return cache[markup] = regex || cache[markup] || this.markupToRegex(markup);
  },

  // get previously cached regex, or build and cache regex from provided markup
  getMarkupRegex: function getMarkupRegex(markup) {
    return this.useMarkupRegex(markup);
  },

  spliceString: function spliceString(str, start, end, insert) {
    return str.substring(0, start) + insert + str.substring(end);
  },

  extend: function extend(obj) {
    var source, prop;
    for (var i = 1, length = arguments.length; i < length; i++) {
      source = arguments[i];
      for (prop in source) {
        if (hasOwnProperty.call(source, prop)) {
          obj[prop] = source[prop];
        }
      }
    }
    return obj;
  },

  isNumber: function isNumber(obj) {
    return Object.prototype.toString.call(obj) === "[object Number]";
  },

  computeCapturingGroupPositions: function computeCapturingGroupPositions(markup) {
    var placeholders = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : PLACEHOLDERS;

    // Build group position map {key: position+1} from placeholders map {key: placeholder}:
    // map its values to get {key: indexInMarkupOrMinus1},
    // invert it to get {indexInMarkupOrMinus1: key} (index is always different for non overlapping placeholders),
    // filter out missing placeholders to get sorted array of [position: key],
    // invert it again to get position map {key: position},
    // and coerce values to number increased by 1 to get group positions map {key: position+1}.
    var positions = (0, _mapValues2.default)((0, _invert2.default)((0, _filter2.default)((0, _invert2.default)((0, _mapValues2.default)(placeholders, function (p) {
      return markup.indexOf(p);
    })), function (k, index) {
      return index >= 0;
    })), function (position) {
      return parseInt(position, 10) + 1;
    });

    // console.log('mentions.plaintext.mention.positions', markup, positions, placeholders);

    if (!positions.id && !positions.display) throw new Error('Markup \'' + markup + '\' has to contain at least one of placeholders __id__ or __display__');

    // if either id or display is not used in markup, use the same group to make id and display equal
    if (!positions.id) positions.id = positions.display;
    if (!positions.display) positions.display = positions.id;

    return positions;
  },

  getCapturingGroupPositions: function getCapturingGroupPositions(markup) {
    var placeholders = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : PLACEHOLDERS;
    var cache = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : PLACEHOLDER_MARKUP_POSITIONS_CACHE;

    // Get group position map {key: position+1} from cache for given markup,
    // or compute it and store in cache
    return cache[markup] || (cache[markup] = this.computeCapturingGroupPositions(markup, placeholders));
  },

  // Finds all occurences of the markup in the value and iterates the plain text sub strings
  // in between those markups using `textIteratee` and the markup occurrences using the
  // `markupIteratee`.
  iterateMentionsMarkup: function iterateMentionsMarkup(value, markup, textIteratee, markupIteratee, displayTransform) {
    var regex = this.getMarkupRegex(markup);

    var _getCapturingGroupPos = this.getCapturingGroupPositions(markup),
        idPos = _getCapturingGroupPos.id,
        typePos = _getCapturingGroupPos.type,
        displayPos = _getCapturingGroupPos.display;

    var match;
    var start = 0;
    var currentPlainTextIndex = 0;

    // detect all mention markup occurences in the value and iterate the matches
    while (match = regex.exec(value)) {

      var id = idPos && match[idPos];
      var type = typePos && match[typePos];
      var display = displayPos && match[displayPos];

      if (displayTransform) display = displayTransform(id, display, type);

      var substr = value.substring(start, match.index);

      // console.log('mentions.plaintext.mention.iter', value, markup, regex, [start, currentPlainTextIndex, match.index],
      //   substr, [typePos, type], [idPos, id], [displayPos, match[displayPos], display]);

      if (textIteratee(substr, start, currentPlainTextIndex)) return;
      currentPlainTextIndex += substr.length;

      if (markupIteratee(match[0], match.index, currentPlainTextIndex, id, display, type, start)) return;
      currentPlainTextIndex += display.length;

      start = regex.lastIndex;
    }

    if (start < value.length) {
      textIteratee(value.substring(start), start, currentPlainTextIndex);
    }
  },

  // For the passed character index in the plain text string, returns the corresponding index
  // in the marked up value string.
  // If the passed character index lies inside a mention, the value of `inMarkupCorrection` defines the
  // correction to apply:
  //   - 'START' to return the index of the mention markup's first char (default)
  //   - 'END' to return the index after its last char
  //   - 'NULL' to return null
  mapPlainTextIndex: function mapPlainTextIndex(value, markup, indexInPlainText) {
    var inMarkupCorrection = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'START';
    var displayTransform = arguments[4];

    if (!this.isNumber(indexInPlainText)) {
      return indexInPlainText;
    }

    var result;
    var textIteratee = function textIteratee(substr, index, substrPlainTextIndex) {
      if (substrPlainTextIndex + substr.length >= indexInPlainText) {
        // found the corresponding position in the current plain text range
        result = index + indexInPlainText - substrPlainTextIndex;
        return true;
      }
    };
    var markupIteratee = function markupIteratee(markup, index, mentionPlainTextIndex, id, display, type, lastMentionEndIndex) {
      if (mentionPlainTextIndex + display.length > indexInPlainText) {
        // found the corresponding position inside current match,
        // return the index of the first or after the last char of the matching markup
        // depending on whether the `inMarkupCorrection`
        result = inMarkupCorrection === 'NULL' ? null : index + (inMarkupCorrection === 'END' ? markup.length : 0);
        return true;
      }
    };

    this.iterateMentionsMarkup(value, markup, textIteratee, markupIteratee, displayTransform);

    // when a mention is at the end of the value and we want to get the caret position
    // at the end of the string, result is undefined
    return result === undefined ? value.length : result;
  },

  // For a given indexInPlainText that lies inside a mention,
  // returns the index of of the first char of the mention in the plain text.
  // If indexInPlainText does not lie inside a mention, returns undefined.
  findStartOfMentionInPlainText: function findStartOfMentionInPlainText(value, markup, indexInPlainText, displayTransform) {
    var result;
    var markupIteratee = function markupIteratee(markup, index, mentionPlainTextIndex, id, display, type, lastMentionEndIndex) {
      // console.log('mentions.plaintext.mention.is-inside.test', index, type, id, display,
      //   [mentionPlainTextIndex, indexInPlainText, mentionPlainTextIndex + display.length, lastMentionEndIndex]);
      if (mentionPlainTextIndex <= indexInPlainText && mentionPlainTextIndex + display.length > indexInPlainText) {
        result = mentionPlainTextIndex;
        return true;
      }
    };
    this.iterateMentionsMarkup(value, markup, function () {}, markupIteratee, displayTransform);

    // console.log('mentions.plaintext.mention.is-inside', value, indexInPlainText, result, {
    //   markup, displayTransform
    // });

    return result;
  },

  // Returns whether the given plain text index lies inside a mention
  isInsideOfMention: function isInsideOfMention(value, markup, indexInPlainText, displayTransform) {
    var mentionStart = this.findStartOfMentionInPlainText(value, markup, indexInPlainText, displayTransform);
    return mentionStart !== undefined && mentionStart !== indexInPlainText;
  },

  // Applies a change from the plain text textarea to the underlying marked up value
  // guided by the textarea text selection ranges before and after the change
  applyChangeToValue: function applyChangeToValue(value, markup, plainTextValue, selectionStartBeforeChange, selectionEndBeforeChange, selectionEndAfterChange, displayTransform, treatMentionAsUnit) {
    var oldPlainTextValue = this.getPlainText(value, markup, displayTransform);

    var lengthDelta = oldPlainTextValue.length - plainTextValue.length;
    if (selectionStartBeforeChange === 'undefined') {
      selectionStartBeforeChange = selectionEndAfterChange + lengthDelta;
    }

    if (selectionEndBeforeChange === 'undefined') {
      selectionEndBeforeChange = selectionStartBeforeChange;
    }

    // Fixes an issue with replacing combined characters for complex input. Eg like acented letters on OSX
    if (selectionStartBeforeChange === selectionEndBeforeChange && selectionEndBeforeChange === selectionEndAfterChange && oldPlainTextValue.length === plainTextValue.length) {
      selectionStartBeforeChange = selectionStartBeforeChange - 1;
    }

    // extract the insertion from the new plain text value
    var insert = plainTextValue.slice(selectionStartBeforeChange, selectionEndAfterChange);

    // handling for Backspace key with no range selection
    var spliceStart = Math.min(selectionStartBeforeChange, selectionEndAfterChange);

    var spliceEnd = selectionEndBeforeChange;
    if (selectionStartBeforeChange === selectionEndAfterChange) {
      // handling for Delete key with no range selection
      spliceEnd = Math.max(selectionEndBeforeChange, selectionStartBeforeChange + lengthDelta);
    }

    var mappedSpliceStart = this.mapPlainTextIndex(value, markup, spliceStart, 'START', displayTransform);
    var mappedSpliceEnd = this.mapPlainTextIndex(value, markup, spliceEnd, 'END', displayTransform);

    var controlSpliceStart = this.mapPlainTextIndex(value, markup, spliceStart, 'NULL', displayTransform);
    var controlSpliceEnd = this.mapPlainTextIndex(value, markup, spliceEnd, 'NULL', displayTransform);
    var willRemoveMention = treatMentionAsUnit && (controlSpliceStart === null || controlSpliceEnd === null);

    var newValue = this.spliceString(value, mappedSpliceStart, mappedSpliceEnd, insert);

    if (!willRemoveMention) {
      // test for auto-completion changes
      var controlPlainTextValue = this.getPlainText(newValue, markup, displayTransform);
      if (controlPlainTextValue !== plainTextValue) {
        // some auto-correction is going on

        // find start of diff
        spliceStart = 0;
        while (plainTextValue[spliceStart] === controlPlainTextValue[spliceStart]) {
          spliceStart++;
        } // extract auto-corrected insertion
        insert = plainTextValue.slice(spliceStart, selectionEndAfterChange);

        // find index of the unchanged remainder
        spliceEnd = oldPlainTextValue.lastIndexOf(plainTextValue.substring(selectionEndAfterChange));

        // re-map the corrected indices
        mappedSpliceStart = this.mapPlainTextIndex(value, markup, spliceStart, 'START', displayTransform);
        mappedSpliceEnd = this.mapPlainTextIndex(value, markup, spliceEnd, 'END', displayTransform);
        newValue = this.spliceString(value, mappedSpliceStart, mappedSpliceEnd, insert);
      }
    }

    return newValue;
  },

  getPlainText: function getPlainText(value, markup, displayTransform) {
    var regex = this.getMarkupRegex(markup);

    var _getCapturingGroupPos2 = this.getCapturingGroupPositions(markup),
        idPos = _getCapturingGroupPos2.id,
        typePos = _getCapturingGroupPos2.type,
        displayPos = _getCapturingGroupPos2.display;

    return value.replace(regex, function () {
      // first argument is the whole match, capturing groups are following
      var id = arguments[idPos];
      var display = arguments[displayPos];
      var type = arguments[typePos];

      if (displayTransform) display = displayTransform(id, display, type);

      // console.log('mentions.plaintext', value, arguments[displayPos+1], display, {
      //   markup, displayTransform, regex, idPos, displayPos, typePos, id, display, type,
      //   display0: arguments[displayPos+1]
      // });

      return display;
    });
  },

  getMentions: function getMentions(value, markup) {
    var mentions = [];
    this.iterateMentionsMarkup(value, markup, function () {}, function (match, index, plainTextIndex, id, display, type, start) {
      mentions.push({
        id: id,
        display: display,
        type: type,
        index: index,
        plainTextIndex: plainTextIndex
      });
    });
    return mentions;
  },

  makeMentionsMarkup: function makeMentionsMarkup(markup, id, display, type) {
    var result = markup.replace(PLACEHOLDERS.id, id);
    result = result.replace(PLACEHOLDERS.display, display);
    result = result.replace(PLACEHOLDERS.type, type);
    return result;
  },

  countSuggestions: function countSuggestions(suggestions) {
    var result = 0;
    for (var prop in suggestions) {
      if (suggestions.hasOwnProperty(prop)) {
        result += suggestions[prop].results.length;
      }
    }
    return result;
  },

  getSuggestions: function getSuggestions(suggestions) {
    var result = [];

    for (var mentionType in suggestions) {
      if (!suggestions.hasOwnProperty(mentionType)) {
        return;
      }

      result = result.concat({
        suggestions: suggestions[mentionType].results,
        descriptor: suggestions[mentionType]
      });
    }

    return result;
  },

  getSuggestion: function getSuggestion(suggestions, index) {
    return this.getSuggestions(suggestions).reduce(function (result, _ref) {
      var suggestions = _ref.suggestions,
          descriptor = _ref.descriptor;
      return [].concat((0, _toConsumableArray3.default)(result), (0, _toConsumableArray3.default)(suggestions.map(function (suggestion) {
        return {
          suggestion: suggestion,
          descriptor: descriptor
        };
      })));
    }, [])[index];
  }

};