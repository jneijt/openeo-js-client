const Utils = require('@openeo/js-commons/src/utils');

/**
 * Manages the files types supported by the back-end.
 */
class FileTypes {

	/**
	 * Creates a new FileTypes object from an API-compatible JSON response.
	 * 
	 * @param {object} data - A capabilities response compatible to the API specification for `GET /file_formats`.
	 */
	constructor(data) {
		this.data = {
			input: {},
			output: {}
		};
		if(!Utils.isObject(data)) {
			return;
		}
		for(let io of ['input', 'output']) {
			for(let type in data[io]) {
				if(!Utils.isObject(data[io])) {
					continue;
				}
				this.data[io][type.toUpperCase()] = data[io][type];
			}
		}
	}

	/**
	 * Returns the file types response as a JSON serializable representation of the data that is API compliant.
	 * 
	 * @returns {object} - A reference to the capabilities response.
	 */
	toJSON() {
		return this.data;
	}

	/**
	 * Returns the input file formats.
	 * 
	 * @returns {object}
	 */
	getInputTypes() {
		return this.data.input;
	}

	/**
	 * Returns the output file formats.
	 * 
	 * @returns {object}
	 */
	getOutputTypes() {
		return this.data.output;
	}

	/**
	 * Returns a single input file format for a given identifier.
	 * 
	 * Returns null if no input file format was found for the given identifier.
	 * 
	 * @param {string} type - Case-insensitive file format identifier
	 * @returns {?object}
	 */
	getInputType(type) {
		return this._findType(type, 'input');
	}

	/**
	 * Returns a single output file format for a given identifier.
	 * 
	 * Returns null if no output file format was found for the given identifier.
	 * 
	 * @param {string} type - Case-insensitive file format identifier
	 * @returns {?object}
	 */
	getOutputType(type) {
		return this._findType(type, 'output');
	}

	/**
	 * Get a file type object from the list of input or output file formats.
	 * 
	 * @param {string} type - Identifier of the file type
	 * @param {string} io - Either `input` or `output`
	 * @returns {?object}
	 * @protected
	 */
	_findType(type, io) {
		type = type.toUpperCase();
		if (type in this.data[io]) {
			return this.data[io][type];
		}
		return null;
	}

}

module.exports = FileTypes;
