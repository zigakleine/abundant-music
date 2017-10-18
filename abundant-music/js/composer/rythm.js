
class Rythm {
    constructor() {
        this.id = "";
        this.rythmElements = [];
        this._constructorName = "Rythm";
    }

    addRythmElement(e) {
        this.rythmElements.push(e);
        return this;
    }

    getRythmElements() {
        return this.rythmElements;
    }

    getNoteRythmElements(module, harmony, harmonyBeatOffset) {
        var result = [];
        for (var i=0; i<this.rythmElements.length; i++) {
            var re = this.rythmElements[i];
            addAll(result, re.getNoteRythmElements(module, harmony, harmonyBeatOffset));
        }
        return result;
    }
}

class RythmElement {
    constructor() {
        this.id = "";
        this.length = 1.0;
        this.lengthUnit = PositionUnit.BEATS;
        this.strength = 1.0;
        this._constructorName = "RythmElement";
    }

    // Must be Note rythm elements as result...
    getNoteRythmElements(module, harmony, harmonyBeatOffset) {
        if (this instanceof NoteRythmElement) {
            return [this];
        } else {
            logit("RythmElements that are not NoteRythmElements must implement getNoteRythmElements()<br />");
        }
    }

    copy() {
        return copyObjectDeep(this);
    }

    setLength(length) {
        this.length = length;
        return this;
    }

    setLengthUnit(lengthUnit) {
        this.lengthUnit = lengthUnit;
        return this;
    }

    getLength() {
        return this.length;
    }

    getLengthUnit() {
        return this.lengthUnit;
    }
}

var NoteRythmElementLengthType = {
    NORMAL: 0,
    DOT: 1,
    TRIPLET: 2,

    toString: function(type) {
        switch (type) {
            case NoteRythmElementLengthType.NORMAL:
                return "Normal";
            case NoteRythmElementLengthType.DOT:
                return "Dotted";
            case NoteRythmElementLengthType.TRIPLET:
                return "Triplet";
        }
        return "Unknown type " + type;
    },

    possibleValues: null,
    getPossibleValues: function() {
        if (!NoteRythmElementLengthType.possibleValues) {
            NoteRythmElementLengthType.possibleValues = [];
            for (var i=NoteRythmElementLengthType.NORMAL; i<=NoteRythmElementLengthType.TRIPLET; i++) {
                NoteRythmElementLengthType.possibleValues.push(i);
            }
        }
        return NoteRythmElementLengthType.possibleValues;
    }
};


class NoteRythmElement extends RythmElement {
    constructor() {
        super();
        this.rest = false;
        this.lengthType = NoteRythmElementLengthType.NORMAL; // Used for splitting and certainly other things later
        this._constructorName = "NoteRythmElement";
    }

    setLengthType(type) {
        this.lengthType = type;
        return this;
    }

    toString() {
        return "NRE{" +
            "length: " + this.length +
            " lengthUnit: " + this.lengthUnit +
            " strength: " + this.strength +
            " rest: " + this.rest +
            " lengthType: " + this.lengthType +
            "}";
    }
}

class SequenceRythmElement extends RythmElement {
    constructor() {
        super();

        this.elementLengths = [1];
        this.elementLengthUnit = PositionUnit.BEATS;
        this.elementLengthBorderMode = IndexBorderMode.RESTART;

        this.elementStrengths = [1.0];
        this.elementStrengthBorderMode = IndexBorderMode.RESTART;

        this.restPattern = [0];
        this.restPatternBorderMode = IndexBorderMode.RESTART;

        this.cutLast = true;

        this.minElementLength = 0;
        this.minElementLengthUnit = PositionUnit.BEATS;
        this._constructorName = "SequenceRythmElement";

    }

    getNoteRythmElements(module, harmony, harmonyBeatOffset) {

        var result = [];

        if (this.elementLengths.length == 0) {
            return result;
        }

        var harmonyElement = harmony.getHarmonyAt(harmonyBeatOffset);

        var totalLength = positionUnitToBeats2(this.length, this.lengthUnit, harmonyBeatOffset, harmony);

        var minBeatLength = positionUnitToBeats2(this.minElementLength, harmonyBeatOffset, harmony);

        var index = 0;
        var currentPosition = 0;
        while (currentPosition < totalLength) {
            var realElementIndex = IndexBorderMode.getIndex(this.elementLengthBorderMode, this.elementLengths.length, index);
            if (realElementIndex == -1) {
                break;
            }
            var elementLength = this.elementLengths[realElementIndex];
            var beatLength = positionUnitToBeats(elementLength, this.elementLengthUnit,
                harmonyElement.tsNumerator, harmonyElement.tsDenominator, harmony);

            var rest = false;
            if (this.restPattern.length > 0) {
                var realRestIndex = IndexBorderMode.getIndex(this.restPatternBorderMode, this.restPattern.length, index);
                if (realRestIndex >= 0) {
                    rest = this.restPattern[realRestIndex] != 0;
                }
            }

            var isLast = false;
            if (currentPosition + beatLength > totalLength) {
                // cut or stop
                isLast = true;
                if (this.cutLast) {
                    beatLength = totalLength - currentPosition;
                } else {
                    rest = true;
                }
            }
            if (!isLast || beatLength >= minBeatLength) {
                var rythmElement = new NoteRythmElement().setLength(beatLength).setLengthUnit(PositionUnit.BEATS);
                rythmElement.rest = rest;
                result.push(rythmElement);
            }

            if (isLast) {
                break;
            }
            index++;
            currentPosition += beatLength;
        }
        return result;
    }
}

class SplitRythmElement extends RythmElement {
    constructor() {
        super();
        this.autoDetectLengthType = true;
        this.startLengthType = NoteRythmElementLengthType.NORMAL; // When auto detect is off
        this.noteCount = 4;
        this.noteCountUnit = CountUnit.PLAIN;
        this.extraNoteCount = 0;
        this.extraNoteCountUnit = CountUnit.PLAIN;
        this.densityCurve = "";
        this.densityCurveAmplitude = 1.0;
        this.densityCurveBias = 0.0;
        this.densityCurveFrequency = 1.0;
        this.densityCurvePhase = 0.0;
        this.minLength = 0.25;
        this.minLengthUnit = PositionUnit.BEATS;
        this.splitZoneCollection = new SplitZoneCollection();
        this._constructorName = "SplitRythmElement";
    }

    addSplitZone(zone) {
        this.splitZoneCollection.addSplitZone(zone);
        return this;
    }

    getNoteRythmElements(module, harmony, harmonyBeatOffset) {

        var theNoteCount = getValueOrExpressionValue(this, "noteCount", module);
        var theExtraNoteCount = getValueOrExpressionValue(this, "extraNoteCount", module);
        var startLengthType = getValueOrExpressionValue(this, "startLengthType", module);
        var length = getValueOrExpressionValue(this, "length", module);


        theNoteCount = CountUnit.getCount(theNoteCount, this.noteCountUnit, harmony, harmonyBeatOffset);
        theNoteCount += CountUnit.getCount(theExtraNoteCount, this.extraNoteCountUnit, harmony, harmonyBeatOffset);

        theNoteCount = Math.round(theNoteCount);
        // logit("the note counte: " + theNoteCount + "<br />");

        var harmonyElement = harmony.getHarmonyAt(harmonyBeatOffset);
        var szc = this.splitZoneCollection;
        szc.minLength = this.minLength;
        szc.minLengthUnit = this.minLengthUnit;

        var beatLength = positionUnitToBeats2(length, this.lengthUnit, harmonyBeatOffset, harmony);

        var startElement = new NoteRythmElement().setLength(beatLength).setLengthUnit(PositionUnit.BEATS);


        if (this.autoDetectLengthType) {
            // Try to detect the length type
            var possibleLengthTypes =
                [NoteRythmElementLengthType.NORMAL, NoteRythmElementLengthType.DOT, NoteRythmElementLengthType.TRIPLET];

            var closestDistance = 9999999;
            var closestIndex = 0;
            var possibleLengthFractions = [1, 1.5, 1.0/3.0];
            for (var i=0; i<possibleLengthFractions.length; i++) {
                var targetFraction = possibleLengthFractions[i];
                var currentFraction = beatLength;
                var theDistance = Math.abs(currentFraction - targetFraction);
                if (theDistance < closestDistance) {
                    closestDistance = theDistance;
                    closestIndex = i;
                }
                while (currentFraction < targetFraction) {
                    currentFraction *= 2;
                    var theDistance = Math.abs(currentFraction - targetFraction);
                    if (theDistance < closestDistance) {
                        closestDistance = theDistance;
                        closestIndex = i;
                    }
                }
                while (currentFraction > targetFraction) {
                    currentFraction /= 2;
                    var theDistance = Math.abs(currentFraction - targetFraction);
                    if (theDistance < closestDistance) {
                        closestDistance = theDistance;
                        closestIndex = i;
                    }
                }
            }
    //        logit("Detected length type: " + NoteRythmElementLengthType.toString(possibleLengthTypes[closestIndex]) + " from " + beatLength);
            startElement.lengthType = possibleLengthTypes[closestIndex];
        } else {
            startElement.lengthType = startLengthType;
        }
        //    logit("Setting lengthType to " + NoteRythmElementLengthType.toString(startElement.lengthType));

        var theCurve = module.getCurve(this.densityCurve);
        if (theCurve == null) {
            logit("Could not find curve " + this.densityCurve + "<br />");
            theCurve = {
                getValue: function(m, x) {
                    return 0;
                }
            };
        } else {
            var originalCurve = theCurve;
            var that = this;
            theCurve = {
                getValue: function(m, x) {
                    return that.densityCurveBias +
                        that.densityCurveAmplitude * originalCurve.getValue(m,
                            that.densityCurveFrequency * (x + that.densityCurvePhase));
                }
            }
        }

        var rythmElements = szc.getSplitBeat(module, [startElement], theNoteCount, theCurve, harmonyElement.tsNumerator, harmonyElement.tsDenominator);

    //    if (this.verbose) {
    //        var beatLengths = [];
    //        for (var i=0; i<rythmElements.length; i++) {
    //            var e = rythmElements[i];
    //            beatLengths[i] = positionUnitToBeats(e.length, e.lengthUnit, harmonyElement.tsNumerator, harmonyElement.tsDenominator);
    //        }
    //        logit("beat length " + beatLength + " resulted in " + beatLengths.join(", ") + " treated as " + NoteRythmElementLengthType.toString(startElement.lengthType));
    //        logit("  " + harmonyElement.tsNumerator);
    //    }

    //    logit(JSON.stringify(rythmElements));

        return rythmElements;
    }

    setNoteCount(c) {
        this.noteCount = c;
        return this;
    }

    setNoteCountUnit(c) {
        this.noteCountUnit = c;
        return this;
    }

    setExtraNoteCount(c) {
        this.extraNoteCount = c;
        return this;
    }

    setExtraNoteCountUnit(c) {
        this.extraNoteCountUnit = c;
        return this;
    }

    setDensityCurve(c) {
        this.densityCurve = c;
        return this;
    }
}

