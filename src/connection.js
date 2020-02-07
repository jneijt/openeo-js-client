import Environment from '@openeo/js-environment';
import { Utils } from '@openeo/js-commons';

import Capabilities from './capabilities';
import File from './file';
import Job from './job';
import ProcessGraph from './processgraph';
import Service from './service';

/**
 * A connection to a back-end.
 * 
 * @class
 */
export default class Connection {

	/**
	 * Creates a new Connection.
	 * 
	 * @param {string} baseUrl - URL to the back-end
	 * @constructor
	 */
	constructor(baseUrl) {
		this.baseUrl = Utils.normalizeUrl(baseUrl);
		this.userId = null;
		this.accessToken = null;
		this.oidc = null;
		this.oidcUser = null;
		this.capabilitiesObject = null;
	}

	/**
	 * Initializes the connection by requesting the capabilities.
	 * 
	 * @async
	 * @returns {Capabilities} Capabilities
	 */
	async init() {
		let response = await this._get('/');
		this.capabilitiesObject = new Capabilities(response.data);
		return this.capabilitiesObject;
	}

	/**
	 * Returns the URL of the back-end currently connected to.
	 * 
	 * @returns {string} The URL or the back-end.
	 */
	getBaseUrl() {
		return this.baseUrl;
	}

	/**
	 * Returns the identifier of the user that is currently authenticated at the back-end.
	 * 
	 * @returns {string} ID of the authenticated user.
	 */
	getUserId() {
		return this.userId;
	}

	/**
	 * Returns the capabilities of the back-end.
	 * 
	 * @returns {Capabilities} Capabilities
	 */
	capabilities() {
		return this.capabilitiesObject;
	}

	/**
	 * List the supported output file formats.
	 * 
	 * @async
	 * @returns {object} A response compatible to the API specification.
	 * @throws {Error}
	 */
	async listFileTypes() {
		let response = await this._get('/output_formats');
		return response.data;
	}

	/**
	 * List the supported secondary service types.
	 * 
	 * @async
	 * @returns {object} A response compatible to the API specification.
	 * @throws {Error}
	 */
	async listServiceTypes() {
		let response = await this._get('/service_types');
		return response.data;
	}

	/**
	 * List the supported UDF runtimes.
	 * 
	 * @async
	 * @returns {object} A response compatible to the API specification.
	 * @throws {Error}
	 */
	async listUdfRuntimes() {
		let response = await this._get('/udf_runtimes');
		return response.data;
	}

	/**
	 * List all collections available on the back-end.
	 * 
	 * @async
	 * @returns {object} A response compatible to the API specification.
	 * @throws {Error}
	 */
	async listCollections() {
		let response = await this._get('/collections');
		return response.data;
	}

	/**
	 * Get further information about a single collection.
	 * 
	 * @async
	 * @param {string} collectionId - Collection ID to request further metadata for.
	 * @returns {object} A response compatible to the API specification.
	 * @throws {Error}
	 */
	async describeCollection(collectionId) {
		let response = await this._get('/collections/' + collectionId);
		return response.data;
	}

	/**
	 * List all processes available on the back-end.
	 * 
	 * @async
	 * @returns {object} A response compatible to the API specification.
	 * @throws {Error}
	 */
	async listProcesses() {
		let response = await this._get('/processes');
		return response.data;
	}

	/**
	 * Sets the OIDC User.
	 * 
	 * @see https://github.com/IdentityModel/oidc-client-js/wiki#user
	 * @param {User} user - The OIDC User returned by OpenEO.signinCallbackOIDC(). Passing `null` resets OIDC authentication details.
	 */
	setUserOIDC(user) {
		if (!user) {
			this.oidcUser = null;
			this.userId = null;
			this.accessToken = null;
		}
		else {
			if (!user.profile) {
				throw "Retrieved token is invalid.";
			}
			this.oidcUser = user;
			if (user.profile.sub) {
				// The sub is not necessarily the correct userId.
				// After authentication describeAccount() should be called to get a safe userId.
				this.userId = user.profile.sub;
			}
			this.accessToken = user.id_token;
		}
	}

	/**
	 * Authenticate with OpenID Connect (OIDC) - EXPERIMENTAL!
	 * 
	 * Supported only in Browser environments.
	 * 
	 * Not required to be called explicitly if specified in `OpenEO.connect`.
	 * 
	 * Please note that the User ID may not be initialized correctly after authenticating with OpenID Connect.
	 * Therefore requests to endpoints requiring the user ID (e.g file management) may fail.
	 * Users should always request the user details using descibeAccount() directly after authentication.
	 * 
	 * @param {object} [authOptions={}] - Object with authentication options. See https://github.com/IdentityModel/oidc-client-js/wiki#other-optional-settings for further options.
	 * @param {string} [authOptions.client_id] - Your client application's identifier as registered with the OIDC provider
	 * @param {string} [authOptions.redirect_uri] - The redirect URI of your client application to receive a response from the OIDC provider.
	 * @param {string} [authOptions.scope=openid] - The scope being requested from the OIDC provider. Defaults to `openid`.
	 * @param {boolean} [authOptions.uiMethod=redirect] - Method how to load and show the authentication process. Either `popup` (opens a popup window) or `redirect` (HTTP redirects, default).
	 * @throws {Error}
	 * @todo Fully implement OpenID Connect authentication {@link https://github.com/Open-EO/openeo-js-client/issues/11}
	 */
	async authenticateOIDC(authOptions) {
		Environment.checkOidcSupport();

		var response = await this._send({
			method: 'get',
			url: '/credentials/oidc',
			maxRedirects: 0 // Disallow redirects
		});
		var responseUrl = response.request.responseURL; // Would be response.request.res.responseUrl in Node
		if (typeof responseUrl !== 'string') {
			throw "No URL available for OpenID Connect Discovery";
		}
		this.oidc = new UserManager(Object.assign({
			authority: responseUrl.replace('/.well-known/openid-configuration', ''),
			response_type: 'token id_token',
			scope: 'openid'
		}, authOptions));
		if (authOptions.uiMethod === 'popup') {
			this.setUserOIDC(await this.oidc.signinPopup());
		}
		else {
			await this.oidc.signinRedirect();
		}
	}

	/**
	 * Authenticate with HTTP Basic.
	 * 
	 * Not required to be called explicitly if specified in `OpenEO.connect`.
	 * 
	 * @async
	 * @param {object} options - Options for Basic authentication.
	 * @returns {object} A response compatible to the API specification.
	 * @throws {Error}
	 */
	async authenticateBasic(username, password) {
		let response = await this._send({
			method: 'get',
			responseType: 'json',
			url: '/credentials/basic',
			headers: {'Authorization': 'Basic ' + Environment.base64encode(username + ':' + password)}
		});
		if (!response.data.user_id) {
			throw new Error("No user_id returned.");
		}
		if (!response.data.access_token) {
			throw new Error("No access_token returned.");
		}
		this.userId = response.data.user_id;
		this.accessToken = response.data.access_token;
		return response.data;
	}

	/**
	 * Logout from the established session - EXPERIMENTAL!
	 * 
	 * @async
	 */
	async logout() {
		if (this.oidc !== null) {
			await this.oidc.signoutRedirect();
			this.oidc = null;
			this.oidcUser = null;
		}
		this.userId = null;
		this.accessToken = null;
	}

	/**
	 * Get information about the authenticated user.
	 * 
	 * Updates the User ID if available.
	 * 
	 * @async
	 * @returns {object} A response compatible to the API specification.
	 * @throws {Error}
	 */
	async describeAccount() {
		let response = await this._get('/me');
		if (response.data && typeof response.data === 'object' && response.data.user_id) {
			this.userId = response.data.user_id;
		}
		return response.data;
	}

	/**
	 * Lists all files from the user workspace. 
	 * 
	 * @async
	 * @param {string} [userId=null] - User ID, defaults to authenticated user.
	 * @returns {File[]} A list of files.
	 * @throws {Error}
	 */
	async listFiles(userId = null) {
		userId = this._resolveUserId(userId);
		let response = await this._get('/files/' + userId);
		return response.data.files.map(
			f => new File(this, userId, f.path).setAll(f)
		);
	}

	/**
	 * Opens a (existing or non-existing) file without reading any information or creating a new file at the back-end. 
	 * 
	 * @param {string} path - Path to the file, relative to the user workspace.
	 * @param {string} [userId=null] - User ID, defaults to authenticated user.
	 * @returns {File} A file.
	 * @throws {Error}
	 */
	openFile(path, userId = null) {
		return new File(this, this._resolveUserId(userId), path);
	}

	/**
	 * Validates a process graph at the back-end.
	 * 
	 * @async
	 * @param {object} processGraph - Process graph to validate.
	 * @retrurns {Object[]} errors - A list of API compatible error objects. A valid process graph returns an empty list.
	 * @throws {Error}
	 */
	async validateProcessGraph(processGraph) {
		let response = await this._post('/validation', {process_graph: processGraph});
		if (Array.isArray(response.data.errors)) {
			return response.data.errors;
		}
		else {
			throw new Error("Invalid validation response received.");
		}
	}

	/**
	 * Lists all process graphs of the authenticated user.
	 * 
	 * @async
	 * @returns {ProcessGraph[]} A list of stored process graphs.
	 * @throws {Error}
	 */
	async listProcessGraphs() {
		let response = await this._get('/process_graphs');
		return response.data.process_graphs.map(
			pg => new ProcessGraph(this, pg.id).setAll(pg)
		);
	}

	/**
	 * Creates a new stored process graph at the back-end.
	 * 
	 * @async
	 * @param {object} processGraph - A process graph (JSON).
	 * @param {string} [title=null] - A title for the stored process graph.
	 * @param {string} [description=null] - A description for the stored process graph.
	 * @returns {ProcessGraph} The new stored process graph.
	 * @throws {Error}
	 */
	async createProcessGraph(processGraph, title = null, description = null) {
		let requestBody = {title: title, description: description, process_graph: processGraph};
		let response = await this._post('/process_graphs', requestBody);
		let obj = new ProcessGraph(this, response.headers['openeo-identifier']).setAll(requestBody);
		if (await this.capabilitiesObject.hasFeature('describeProcessGraph')) {
			return obj.describeProcessGraph();
		}
		else {
			return obj;
		}
	}

	/**
	 * Get all information about a stored process graph.
	 * 
	 * @async
	 * @param {string} id - Process graph ID. 
	 * @returns {ProcessGraph} The stored process graph.
	 * @throws {Error}
	 */
	async getProcessGraphById(id) {
		let pg = new ProcessGraph(this, id);
		return await pg.describeProcessGraph();
	}

	/**
	 * Executes a process graph synchronously and returns the result as the response.
	 * 
	 * Please note that requests can take a very long time of several minutes or even hours.
	 * 
	 * @async
	 * @param {object} processGraph - A process graph (JSON).
	 * @param {string} [plan=null] - The billing plan to use for this computation.
	 * @param {number} [budget=null] - The maximum budget allowed to spend for this computation.
	 * @returns {Stream|Blob} - Returns the data as `Stream` in NodeJS environments or as `Blob` in browsers.
	 */
	async computeResult(processGraph, plan = null, budget = null) {
		let requestBody = {
			process_graph: processGraph,
			plan: plan,
			budget: budget
		};
		let response = await this._post('/result', requestBody, Environment.getResponseType());
		return response.data;
	}

	/**
	 * Lists all batch jobs of the authenticated user.
	 * 
	 * @async
	 * @returns {Job[]} A list of jobs.
	 * @throws {Error}
	 */
	async listJobs() {
		let response = await this._get('/jobs');
		return response.data.jobs.map(
			j => new Job(this, j.id).setAll(j)
		);
	}

	/**
	 * Creates a new batch job at the back-end.
	 * 
	 * @async
	 * @param {object} processGraph - A process graph (JSON).
	 * @param {string} [title=null] - A title for the batch job.
	 * @param {string} [description=null] - A description for the batch job.
	 * @param {string} [plan=null] - The billing plan to use for this batch job.
	 * @param {number} [budget=null] - The maximum budget allowed to spend for this batch job.
	 * @param {object} [additional={}] - Proprietary parameters to pass for the batch job.
	 * @returns {Job} The stored batch job.
	 * @throws {Error}
	 */
	async createJob(processGraph, title = null, description = null, plan = null, budget = null, additional = {}) {
		let requestBody = Object.assign({}, additional, {
			title: title,
			description: description,
			process_graph: processGraph,
			plan: plan,
			budget: budget
		});
		let response = await this._post('/jobs', requestBody);
		let job = new Job(this, response.headers['openeo-identifier']).setAll(requestBody);
		if (this.capabilitiesObject.hasFeature('describeJob')) {
			return await job.describeJob();
		}
		else {
			return job;
		}
	}

	/**
	 * Get all information about a batch job.
	 * 
	 * @async
	 * @param {string} id - Batch Job ID. 
	 * @returns {Job} The batch job.
	 * @throws {Error}
	 */
	async getJobById(id) {
		let job = new Job(this, id);
		return await job.describeJob();
	}

	/**
	 * Lists all secondary web services of the authenticated user.
	 * 
	 * @async
	 * @returns {Job[]} A list of services.
	 * @throws {Error}
	 */
	async listServices() {
		let response = await this._get('/services');
		return response.data.services.map(
			s => new Service(this, s.id).setAll(s)
		);
	}

	/**
	 * Creates a new secondary web service at the back-end. 
	 * 
	 * @async
	 * @param {object} processGraph - A process graph (JSON).
	 * @param {string} type - The type of service to be created (see `Connection.listServiceTypes()`).
	 * @param {string} [title=null] - A title for the service.
	 * @param {string} [description=null] - A description for the service.
	 * @param {boolean} [enabled=true] - Enable the service (`true`, default) or not (`false`).
	 * @param {object} [parameters={}] - Parameters to pass to the service.
	 * @param {string} [plan=null] - The billing plan to use for this service.
	 * @param {number} [budget=null] - The maximum budget allowed to spend for this service.
	 * @returns {Service} The stored service.
	 * @throws {Error}
	 */
	async createService(processGraph, type, title = null, description = null, enabled = true, parameters = {}, plan = null, budget = null) {
		let requestBody = {
			title: title,
			description: description,
			process_graph: processGraph,
			type: type,
			enabled: enabled,
			parameters: parameters,
			plan: plan,
			budget: budget
		};
		let response = await this._post('/services', requestBody);
		let service = new Service(this, response.headers['openeo-identifier']).setAll(requestBody);
		if (this.capabilitiesObject.hasFeature('describeService')) {
			return service.describeService();
		}
		else {
			return service;
		}
	}

	/**
	 * Get all information about a secondary web service.
	 * 
	 * @async
	 * @param {string} id - Service ID. 
	 * @returns {Job} The service.
	 * @throws {Error}
	 */
	async getServiceById(id) {
		let service = new Service(this, id);
		return await service.describeService();
	}

	async _get(path, query, responseType) {
		return await this._send({
			method: 'get',
			responseType: responseType,
			url: path,
			// Timeout for capabilities requests as they are used for a quick first discovery to check whether the server is a openEO back-end.
			// Without timeout connecting with a wrong server url may take forever.
			timeout: path === '/' ? 3000 : 0,
			params: query
		});
	}

	async _post(path, body, responseType) {
		return await this._send({
			method: 'post',
			responseType: responseType,
			url: path,
			data: body
		});
	}

	async _patch(path, body) {
		return await this._send({
			method: 'patch',
			url: path,
			data: body
		});
	}

	async _delete(path) {
		return await this._send({
			method: 'delete',
			url: path
		});
	}

	/**
	 * Downloads data from a URL.
	 * 
	 * May include authorization details where required.
	 * 
	 * @param {string} url - An absolute or relative URL to download data from.
	 * @param {boolean} authorize - Send authorization details (`true`) or not (`false`).
	 * @returns {Stream|Blob} - Returns the data as `Stream` in NodeJS environments or as `Blob` in browsers
	 */
	async download(url, authorize) {
		return await this._send({
			method: 'get',
			responseType: Environment.getResponseType(),
			url: url,
			withCredentials: authorize
		});
	}

	async _send(options) {
		options.baseURL = this.baseUrl;
		if (this.isLoggedIn() && (typeof options.withCredentials === 'undefined' || options.withCredentials === true)) {
			options.withCredentials = true;
			if (!options.headers) {
				options.headers = {};
			}
			options.headers.Authorization = 'Bearer ' + this.accessToken;
		}
		if (!options.responseType) {
			options.responseType = 'json';
		}

		try {
			return await axios(options);
		} catch(error) {
			if (Utils.isObject(error.response) && Utils.isObject(error.response.data) && ((typeof error.response.data.type === 'string' && error.response.data.type.indexOf('/json') !== -1) || (Utils.isObject(error.response.data.headers) && typeof error.response.data.headers['content-type'] === 'string' && error.response.data.headers['content-type'].indexOf('/json') !== -1))) {
				if (options.responseType === Environment.getResponseType()) {
					// JSON error responses are Blobs and streams if responseType is set as such, so convert to JSON if required.
					// See: https://github.com/axios/axios/issues/815
					return Environment.handleErrorResponse(error);
				}
			}
			// Re-throw error if it was not handled yet.
			throw error;
		}
	}

	_resolveUserId(userId = null) {
		if(userId === null) {
			if(this.userId === null) {
				throw new Error("Parameter 'userId' not specified and no default value available because user is not logged in.");
			}
			else {
				userId = this.userId;
			}
		}
		return userId;
	}

	/**
	 * Returns whether the user is authenticated (logged in) at the back-end or not.
	 * 
	 * @returns {boolean} `true` if authenticated, `false` if not.
	 */
	isLoggedIn() {
		return (this.accessToken !== null);
	}
}