import { Utils } from '@openeo/js-commons';

/**
 * Capabilities of a back-end.
 * 
 * @class
 */
export default class Capabilities {

	/**
	 * Creates a new Capabilities object from an API-compatible JSON response.
	 * 
	 * @param {object} data - A capabilities response compatible to the API specification.
	 * @throws {Error}
	 * @constructor
	 */
	constructor(data) {
		if(!Utils.isObject(data)) {
			throw new Error("No capabilities retrieved.");
		}
		if(!data.api_version) {
			throw new Error("Invalid capabilities: No API version retrieved");
		}
		if(!Array.isArray(data.endpoints)) {
			throw new Error("Invalid capabilities: No endpoints retrieved");
		}

		this.data = data;

		// Flatten features to be compatible with the feature map.
		this.features = this.data.endpoints
			.map(e => e.methods.map(method => (method + ' ' + e.path).toLowerCase()))
			.flat(1);

		this.featureMap = {
			capabilities: 'get /',
			listFileTypes: 'get /output_formats',
			listServiceTypes: 'get /service_types',
			listUdfRuntimes: 'get /udf_runtimes',
			listCollections: 'get /collections',
			describeCollection: 'get /collections/{collection_id}',
			listProcesses: 'get /processes',
			authenticateOIDC: 'get /credentials/oidc',
			authenticateBasic: 'get /credentials/basic',
			describeAccount: 'get /me',
			listFiles: 'get /files/{user_id}',
			validateProcessGraph: 'post /validation',
			createProcessGraph: 'post /process_graphs',
			listProcessGraphs: 'get /process_graphs',
			computeResult: 'post /result',
			listJobs: 'get /jobs',
			createJob: 'post /jobs',
			listServices: 'get /services',
			createService: 'post /services',
			downloadFile: 'get /files/{user_id}/{path}',
			openFile: 'put /files/{user_id}/{path}',
			uploadFile: 'put /files/{user_id}/{path}',
			deleteFile: 'delete /files/{user_id}/{path}',
			getJobById: 'get /jobs/{job_id}',
			describeJob: 'get /jobs/{job_id}',
			updateJob: 'patch /jobs/{job_id}',
			deleteJob: 'delete /jobs/{job_id}',
			estimateJob: 'get /jobs/{job_id}/estimate',
			startJob: 'post /jobs/{job_id}/results',
			stopJob: 'delete /jobs/{job_id}/results',
			listResults: 'get /jobs/{job_id}/results',
			downloadResults: 'get /jobs/{job_id}/results',
			describeProcessGraph: 'get /process_graphs/{process_graph_id}',
			getProcessGraphById: 'get /process_graphs/{process_graph_id}',
			updateProcessGraph: 'patch /process_graphs/{process_graph_id}',
			deleteProcessGraph: 'delete /process_graphs/{process_graph_id}',
			describeService: 'get /services/{service_id}',
			getServiceById: 'get /services/{service_id}',
			updateService: 'patch /services/{service_id}',
			deleteService: 'delete /services/{service_id}'
		};
	}

	/**
	 * Returns the capabilities response as a plain object.
	 * 
	 * @returns {object} - A reference to the capabilities response.
	 */
	toPlainObject() {
		return this.data;
	}

	/**
	 * Returns the openEO API version implemented by the back-end.
	 * 
	 * @returns {string} openEO API version number.
	 */
	apiVersion() {
		return this.data.api_version;
	}

	/**
	 * Returns the back-end version number.
	 * 
	 * @returns {string} openEO back-end version number.
	 */
	backendVersion() {
		return this.data.backend_version;
	}

	/**
	 * Returns the back-end title.
	 * 
	 * @returns {string} Title
	 */
	title() {
		return this.data.title || "";
	}

	/**
	 * Returns the back-end description.
	 * 
	 * @returns {string} Description
	 */
	description() {
		return this.data.description || "";
	}

	/**
	 * Lists all supported features.
	 * 
	 * @returns {string[]} An array of supported features.
	 */
	listFeatures() {
		let features = [];
		for(let feature in this.featureMap) {
			if (this.features.includes(this.featureMap[feature])) {
				features.push(feature);
			}
		}
		return features;
	}

	/**
	 * Check whether a feature is supported by the back-end.
	 * 
	 * @param {string} methodName - A feature name (corresponds to the JS client method names, see also the feature map for allowed values).
	 * @returns {boolean} `true` if the feature is supported, otherwise `false`.
	 */
	hasFeature(methodName) {
		return this.features.some(e => e === this.featureMap[methodName]);
	}

	/**
	 * Get the billing currency.
	 * 
	 * @returns {string|null} The billing currency or `null` if not available.
	 */
	currency() {
		return (this.data.billing && typeof this.data.billing.currency === 'string' ? this.data.billing.currency : null);
	}

	/**
	 * @typedef BillingPlan
	 * @type {Object}
	 * @property {string} name - Name of the billing plan.
	 * @property {string} description - A description of the billing plan, may include CommonMark syntax.
	 * @property {boolean} paid - `true` if it is a paid plan, otherwise `false`.
	 * @property {string} url - A URL pointing to a page describing the billing plan.
	 * @property {boolean} default - `true` if it is the default plan of the back-end, otherwise `false`.
	 */

	/**
	 * List all billing plans.
	 * 
	 * @returns {BillingPlan[]} Billing plans
	 */
	listPlans() {
		if (this.data.billing && Array.isArray(this.data.billing.plans)) {
			let plans = this.data.billing.plans;
			return plans.map(plan => {
				plan.default = (typeof this.data.billing.default_plan === 'string' && this.data.billing.default_plan.toLowerCase() === plan.name.toLowerCase());
				return plan;
			});
		}
		else {
			return [];
		}
	}
}