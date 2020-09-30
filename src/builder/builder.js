const BuilderNode = require('./node');
const Parameter = require('./parameter');
const Formula = require('./formula');
const axios = require('axios');
const Utils = require('@openeo/js-commons/src/utils');
const ProcessUtils = require("@openeo/js-commons/src/processUtils");

const PROCESS_META = [
	"id", "summary", "description", "categories", "parameters", "returns",
	"deprecated", "experimental", "exceptions", "examples", "links"
];

/**
 * A class to construct processes easily.
 * 
 * An example (`con` is a object of type `Connection`):
 * 
 * ```
 * var builder = await con.buildProcess();
 * 
 * var datacube = builder.load_collection(
 *   new Parameter("collection-id", "string", "The ID of the collection to load"), // collection-id is then a process parameter that can be specified by users.
 *   { "west": 16.1, "east": 16.6, "north": 48.6, "south": 47.2 },
 *   ["2018-01-01", "2018-02-01"],
 *   ["B02", "B04", "B08"]
 * );
 * 
 * // Alternative 1 - using the Formula class
 * var eviAlgorithm = new Formula('2.5 * (($B08 - $B04) / (1 + $B08 + 6 * $B04 + -7.5 * $B02))');
 * // Alternative 2 - "by hand"
 * var eviAlgorithm = function(data) {
 *   var nir = data["B08"]; // Array access by label, accessing label "B08" here
 *   var red = data["B04"];
 *   var blue = data["B02"];
 *   return this.multiply(
 *     2.5,
 *     this.divide(
 *       this.subtract(nir, red),
 *       this.sum([
 *         1,
 *         nir,
 *         this.multiply(6, red),
 *         this.multiply(-7.5, blue)
 *       ])
 *     )
 *   );
 * };
 * datacube = builder.reduce_dimension(datacube, eviAlgorithm, "bands")
 *                   .description("Compute the EVI. Formula: 2.5 * (NIR - RED) / (1 + NIR + 6*RED + -7.5*BLUE)");
 *                   
 * var min = function(data) { return this.min(data); };
 * datacube = builder.reduce_dimension(datacube, min, "t");
 * 
 * datacube = builder.save_result(datacube, "PNG");
 * 
 * var storedProcess = await con.setUserProcess("evi", datacube);
 * ```
 * 
 * @class
 */
class Builder {

	/**
	 * Creates a Builder instance that can be used without connecting to a back-end.
	 * 
	 * It requests the processes for the version specified from processes.openeo.org.
	 * Requests the latest version if no version number is passed.
	 * 
	 * @async
	 * @static
	 * @param {string|null} version 
	 * @returns {Builder}
	 * @throws {Error}
	 */
	static async fromVersion(version = null) {
		let url = 'https://processes.openeo.org/processes.json';
		if (typeof version === 'string') {
			url = 'https://processes.openeo.org/' + version + '/processes.json';
		}
		return await Builder.fromURL(url);
	}

	/**
	 * Creates a Builder instance that can be used without connecting to a back-end.
	 * 
	 * It requests the processes for the version specified from the given URL.
	 * CORS needs to be implemented on the server-side for the URL given.
	 * 
	 * @async
	 * @static
	 * @param {string|null} version 
	 * @returns {Builder}
	 * @throws {Error}
	 */
	static async fromURL(url) {
		let response = await axios(url);
		return new Builder(response.data);
	}

	/**
	 * Creates a Builder instance.
	 * 
	 * Each process passed to the constructor is made available as object method.
	 * 
	 * @param {array|object} processes - Either an array containing processes or an object compatible with `GET /processes` of the API.
	 * @param {Builder|null} parent - The parent builder, usually only used by the Builder itself.
	 * @param {string} id - A unique identifier for the process.
	 */
	constructor(processes, parent = null, id = undefined) {
		this.parent = parent; // parent builder
		this.parentNode = null; // parent node
		this.parentParameter = null; // parent parameter name
		if (Array.isArray(processes)) {
			this.processes = processes;
		}
		else if (Utils.isObject(processes) && Array.isArray(processes.processes)) {
			this.processes = processes.processes;
		}
		else {
			throw new Error("Processes are invalid; must be array or object according to API.");
		}
		this.nodes = {};
		this.idCounter = {};
		this.callbackParameterCache = {};

		this.id = id;

		/* jshint ignore:start */
		for(let process of this.processes) {
			if (typeof this[process.id] === 'undefined') {
				this[process.id] = function() {
					// Don't use arrow functions, they don't support the arguments keyword.
					return this.process(process.id, [...arguments]);
				};
			}
			else {
				console.warn("Can't create function for process '" + process.id + "'. Already exists in Builder class.");
			}
		}
		/* jshint ignore:end */
	}

	setParent(node, parameterName) {
		this.parentNode = node;
		this.parentParameter = parameterName;
	}

	createCallbackParameter(parameterName) {
		if (!this.callbackParameterCache[parameterName]) {
			this.callbackParameterCache[parameterName] = Parameter.create(this, parameterName);
		}
		return this.callbackParameterCache[parameterName];
	}

	getParentCallbackParameters() {
		// ToDo: Should this also pass callback parameters from parents until root is reached?
		let callbackParams = [];
		if (this.parentNode && this.parentParameter) {
			try {
				callbackParams = ProcessUtils.getCallbackParametersForProcess(this.parentNode.spec, this.parentParameter).map(param => this.createCallbackParameter(param.name));
			} catch(error) {
				console.warn(error);
			}
		}
		return callbackParams;
	}

	addParameter(parameter, root = true) {
		if (this.getParentCallbackParameters().find(p => p.name === parameter.name) !== undefined) {
			return; // parameter refers to callback
		}

		let builder = this;
		if (root) {
			while(builder.parent) {
				builder = builder.parent;
			}
		}
		if (!Array.isArray(builder.parameters)) {
			builder.parameters = [];
		}
		let existing = builder.parameters.findIndex(p => p.name === parameter.name);
		if (existing !== -1) {
			Object.assign(builder.parameters[existing], parameter); // Merge
		}
		else {
			builder.parameters.push(parameter); // Add
		}
	}

	spec(id) {
		return this.processes.find(process => process.id === id);
	}

	/**
	 * Adds a mathematical formula to the process.
	 * 
	 * See the {@link Formula} class for more information.
	 * 
	 * @param {string} formula 
	 * @returns {BuilderNode}
	 * @throws {Error}
	 */
	math(formula) {
		let math = new Formula(formula);
		math.setBuilder(this);
		return math.generate(false);
	}

	/**
	 * Adds another process call to the process chain.
	 * 
	 * @param {string} processId - The id of the process to call.
	 * @param {object|array} args - The arguments as key-value pairs or as array. For objects, they keys must be the parameter names and the values must be the arguments. For arrays, arguments must be specified in the same order as in the corresponding process.
	 * @param {string|null} description - An optional description for the process call.
	 * @returns {BuilderNode}
	 */
	process(processId, args = {}, description = null) {
		var node = new BuilderNode(this, processId, args, description);
		this.nodes[node.id] = node;
		return node;
	}

	toJSON() {
		let process = {
			process_graph: Utils.mapObjectValues(this.nodes, node => node.toJSON())
		};
		PROCESS_META.forEach(key => {
			if (typeof this[key] !== 'undefined') {
				process[key] = this[key];
			}
		});
		return process;
	}
	
	generateId(name) {
		name = name.replace("_", "").substr(0, 6);
		if (!this.idCounter[name]) {
			this.idCounter[name] = 1;
		}
		else {
			this.idCounter[name]++;
		}
		return name + this.idCounter[name];
	}

}

module.exports = Builder;