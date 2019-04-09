const { OpenEO } = require('../openeo.js');
const waitForExpect = require("wait-for-expect");

jest.setTimeout(60000); // Give Google some time to process data

describe('With earth-engine-driver', () => {
	const TESTBACKEND = 'https://earthengine.openeo.org';
	const TESTBACKENDDIRECT = TESTBACKEND + '/v0.4';
	const TESTUSERNAME = 'group5';
	const TESTPASSWORD = 'test123';
	const TESTCAPABILITIES = {"api_version":"0.4.0","backend_version":"0.4.0","title":"Google Earth Engine Proxy for openEO","description":"This is the Google Earth Engine Driver for openEO.\n\nGoogle Earth Engine is a planetary-scale platform for Earth science data & analysis. It is powered by Google's cloud infrastructure and combines a multi-petabyte catalog of satellite imagery and geospatial datasets with planetary-scale analysis capabilities. Google makes it available for scientists, researchers, and developers to detect changes, map trends, and quantify differences on the Earth's surface. Google Earth Engine is free for research, education, and nonprofit use.","endpoints":[{"path":"/","methods":["GET"]},{"path":"/service_types","methods":["GET"]},{"path":"/output_formats","methods":["GET"]},{"path":"/stac","methods":["GET"]},{"path":"/collections","methods":["GET"]},{"path":"/collections/{collection_id}","methods":["GET"]},{"path":"/processes","methods":["GET"]},{"path":"/files/{user_id}","methods":["GET"]},{"path":"/files/{user_id}/{path}","methods":["GET","PUT","DELETE"]},{"path":"/result","methods":["POST"]},{"path":"/jobs","methods":["POST","GET"]},{"path":"/jobs/{job_id}","methods":["GET","PATCH","DELETE"]},{"path":"/jobs/{job_id}/results","methods":["GET","POST"]},{"path":"/temp/{token}/{file}","methods":["GET"]},{"path":"/storage/{job_id}/{file}","methods":["GET"]},{"path":"/services","methods":["GET","POST"]},{"path":"/services/{service_id}","methods":["GET","PATCH","DELETE"]},{"path":"/xyz/{service_id}/{z}/{x}/{y}","methods":["GET"]},{"path":"/subscription","methods":["GET"]},{"path":"/credentials/basic","methods":["GET"]},{"path":"/credentials","methods":["POST"]},{"path":"/me","methods":["GET"]},{"path":"/validation","methods":["POST"]},{"path":"/process_graphs","methods":["GET","POST"]},{"path":"/process_graphs/{process_graph_id}","methods":["GET","PATCH","DELETE"]}],"billing":{"currency":"USD","default_plan":"free","plans":[{"name":"free","description":"Earth Engine is free for research, education, and nonprofit use. For commercial applications, Google offers paid commercial licenses. Please contact earthengine-commercial@google.com for details.","paid":false}]},"links":[{"rel":"about","href":"https://earthengine.google.com/","title":"Google Earth Engine Homepage"},{"rel":"related","href":"https://github.com/Open-EO/openeo-earthengine-driver","title":"GitHub repository"},{"rel":"version-history","href":TESTBACKEND+"/.well-known/openeo","type":"application/json","title":"Supported API versions"}]};
	const TESTCOLLECTION = {"id":"AAFC/ACI","title":"Canada AAFC Annual Crop Inventory","description":"Starting in 2009, the Earth Observation Team of the Science and Technology\nBranch (STB) at Agriculture and Agri-Food Canada (AAFC) began the process\nof generating annual crop type digital maps. Focusing on the Prairie\nProvinces in 2009 and 2010, a Decision Tree (DT) based methodology was\napplied using optical (Landsat-5, AWiFS, DMC) and radar (Radarsat-2) based\nsatellite images. Beginning with the 2011 growing season, this activity has\nbeen extended to other provinces in support of a national crop inventory.\nTo date this approach can consistently deliver a crop inventory that meets\nthe overall target accuracy of at least 85% at a final spatial resolution of\n30m (56m in 2009 and 2010).\n","license":"proprietary","providers":[{"name":"Agriculture and Agri-Food Canada","roles":["producer","licensor"],"url":"https://open.canada.ca/data/en/dataset/ba2645d5-4458-414d-b196-6303ac06c1c9"},{"name":"Google Earth Engine","roles":["host"],"url":"https://developers.google.com/earth-engine/datasets/catalog/AAFC_ACI"}],"extent":{"spatial":[-135.17,36.83,-51.24,62.25],"temporal":["2009-01-01T00:00:00Z",null]},"links":[{"rel":"self","href":TESTBACKENDDIRECT+"/collections/AAFC/ACI"},{"rel":"parent","href":TESTBACKENDDIRECT+"/collections"},{"rel":"root","href":TESTBACKENDDIRECT+"collections"},{"rel":"source","href":"http://www.agr.gc.ca/atlas/data_donnees/agr/annualCropInventory/tif"}]};
	const TESTPROCESS = {"id":"min_time","deprecated":true,"summary":"Calculates minimum values of time series.","description":"Finds the minimum value of time series for all bands of the input dataset.","parameters":{"imagery":{"description":"EO data to process.","required":true,"schema":{"type":"object","format":"raster-cube"}}},"returns":{"description":"Processed EO data.","schema":{"type":"object","format":"raster-cube"}}};
	const TESTPROCESSGGRAPH = {"filter1":{"process_id":"filter_daterange","arguments":{"imagery":{"from_node":"loadco1"},"extent":["2018-01-01T00:00:00Z","2018-01-31T23:59:59Z"]}},"loadco1":{"process_id":"get_collection","arguments":{"name":"COPERNICUS/S2"}},"filter2":{"process_id":"filter_bbox","arguments":{"imagery":{"from_node":"filter1"},"extent":{"west":16.5,"east":16.6,"north":48.6,"south":48.5}}},"ndvi1":{"process_id":"NDVI","arguments":{"imagery":{"from_node":"filter2"},"red":"B4","nir":"B8"}},"mint1":{"process_id":"min_time","arguments":{"imagery":{"from_node":"ndvi1"}}},"export":{"process_id":"save_result","arguments":{"data":{"from_node":"mint1"},"format":"png"},"result":true}};
	var isBrowserEnv = (typeof Blob !== 'undefined');

	async function connectWithoutAuth() {
		return OpenEO.connect(TESTBACKEND);
	}

	async function connectWithBasicAuth() {
		return OpenEO.connect(TESTBACKEND, 'basic', {username: TESTUSERNAME, password: TESTPASSWORD});
	}

	describe('Connecting', () => {
		test('Connect without credentials', async () => {
			var con = await connectWithoutAuth();
			expect(con).not.toBeNull();
			expect(Object.getPrototypeOf(con).constructor.name).toBe('Connection');
			expect(con.isLoggedIn()).toBeFalsy();
			expect(con.getUserId()).toBeNull();
			expect(con.getBaseUrl()).toBe(TESTBACKENDDIRECT);
		});

		test('Connect with Basic Auth credentials', async () => {
			var con = await connectWithBasicAuth()
			expect(con).not.toBeNull();
			expect(Object.getPrototypeOf(con).constructor.name).toBe('Connection');
			expect(con.isLoggedIn()).toBeTruthy();
			expect(con.getUserId()).toBe(TESTUSERNAME);
			expect(con.getBaseUrl()).toBe(TESTBACKENDDIRECT);
		});

		test('Connect directly to a known version', async () => {
			await expect(OpenEO.connect(TESTBACKENDDIRECT)).resolves.not.toBeNull();
		});

		test('Connect with wrong Server URL', async () => {
			await expect(OpenEO.connect("http://localhost:12345")).rejects.toThrow();
		});

		test('Connect with wrong Basic Auth credentials', async () => {
			await expect(OpenEO.connect(TESTBACKEND, 'basic', {username: "foo", password: "bar"})).rejects.toThrow();
		});

		test('Manually connect with Basic Auth credentials', async () => {
			var con = await connectWithoutAuth();
			expect(con).not.toBeNull();
			expect(Object.getPrototypeOf(con).constructor.name).toBe('Connection');
			expect(con.isLoggedIn()).toBeFalsy();
			expect(con.getUserId()).toBeNull();
			var login = await con.authenticateBasic(TESTUSERNAME, TESTPASSWORD);
			expect(con.isLoggedIn()).toBeTruthy();
			expect(con.getUserId()).toBe(TESTUSERNAME);
			expect(con.getBaseUrl()).toBe(TESTBACKENDDIRECT);
			expect(login).toHaveProperty('user_id');
			expect(login).toHaveProperty('access_token');
		});

		test('Auth via OIDC is not implemented yet', async () => {
			var con = await connectWithoutAuth();
			expect(con).not.toBeNull();
			expect(Object.getPrototypeOf(con).constructor.name).toBe('Connection');
			expect(con.isLoggedIn()).toBeFalsy();
			expect(con.getUserId()).toBeNull();
			expect(con.getBaseUrl()).toBe(TESTBACKENDDIRECT);
			await expect(con.authenticateOIDC({})).rejects.toThrow(new Error('Not implemented yet.'));
		});

		test('Manually connect with wrong Basic Auth credentials', async () => {
			var con = await connectWithoutAuth();
			expect(con).not.toBeNull();
			expect(Object.getPrototypeOf(con).constructor.name).toBe('Connection');
			expect(con.isLoggedIn()).toBeFalsy();
			expect(con.getUserId()).toBeNull();
			await expect(con.authenticateBasic("foo", "bar")).rejects.toThrow();
			expect(con.isLoggedIn()).toBeFalsy();
			expect(con.getUserId()).toBeNull();
			expect(con.getBaseUrl()).toBe(TESTBACKENDDIRECT);
		});

		test('Connect via OIDC is not implemented yet', async () => {
			await expect(OpenEO.connect(TESTBACKEND, 'oidc', {})).rejects.toThrow(new Error('Not implemented yet.'));
		});

		test('Connect via unknown should throw an error', async () => {
			await expect(OpenEO.connect(TESTBACKEND, 'unknown', {})).rejects.toThrow(new Error("Unknown authentication type."));
		});
	});
	
	describe('Discovery', () => {
		var con;
		beforeAll(async (done) => {
			con = await connectWithoutAuth();
			done();
		});
		
		test('Capabilities', async () => {
			var caps = await con.capabilities();
			expect(caps).not.toBeNull();
			expect(Object.getPrototypeOf(caps).constructor.name).toBe('Capabilities');
			expect(caps.data).toEqual(TESTCAPABILITIES);
			expect(caps.apiVersion()).toBe(TESTCAPABILITIES.api_version);
			expect(caps.backendVersion()).toBe(TESTCAPABILITIES.backend_version);
			expect(caps.title()).toBe(TESTCAPABILITIES.title);
			expect(caps.description()).toBe(TESTCAPABILITIES.description);
			expect(caps.listFeatures()).toEqual(TESTCAPABILITIES.endpoints);
			expect(caps.listPlans()).toEqual(TESTCAPABILITIES.billing.plans);
			expect(caps.currency()).toEqual(TESTCAPABILITIES.billing.currency);
			expect(caps.hasFeature('startJob')).toBeTruthy();
			expect(caps.hasFeature('createFile')).toBeTruthy();
			expect(caps.hasFeature('somethingThatIsntSupported')).toBeFalsy();
		});

		test('Collections', async () => {
			var colls = await con.listCollections();
			expect(colls).not.toBeNull();
			expect(colls).toHaveProperty('collections');
			expect(colls).toHaveProperty('links');
			expect(Array.isArray(colls.collections)).toBe(true);
			expect(colls.collections.length).toBeGreaterThan(100);
			expect(colls.collections[0]).toHaveProperty("description");
			expect(colls.collections[0]).toHaveProperty("license");
			expect(colls.collections[0]).toHaveProperty("extent");
			expect(colls.collections[0]).toHaveProperty("links");
		});

		test('Collections in detail', async () => {
			var coll = await con.describeCollection(TESTCOLLECTION.id);
			expect(coll).not.toBeNull();
			expect(coll).toHaveProperty('description');
			expect(coll).toHaveProperty('license');
			expect(coll).toHaveProperty('extent');
			expect(coll).toHaveProperty('links');
			expect(coll).toHaveProperty('properties');
			expect(coll.id).toBe(TESTCOLLECTION.id);
		});

		test('Processes', async () => {
			var procs = await con.listProcesses();
			expect(procs).not.toBeNull();
			expect(procs).toHaveProperty('processes');
			expect(procs.processes.length).toBeGreaterThan(10);
			expect(procs.processes).toContainEqual(TESTPROCESS);
		});

		test('File types', async () => {
			var types = await con.listFileTypes();
			expect(types).not.toBeNull();
			expect(types).toHaveProperty('PNG');
		});

		test('Service types', async () => {
			var types = await con.listServiceTypes();
			expect(types).not.toBeNull();
			expect(types).toHaveProperty('xyz');
		});
	});

	describe('Getting user-specific data', () => {
		var con;
		beforeAll(async (done) => {
			con = await connectWithBasicAuth();
			done();
		});

		test('Describe account', async () => {
			var acc = await con.describeAccount();
			expect(acc).not.toBeNull();
			expect(acc.user_id).toBe(TESTUSERNAME);
		});
	});

	describe('Process graph validation', () => {
		var con;
		beforeAll(async (done) => {
			con = await connectWithBasicAuth();
			done();
		});

		test('Valid process graph', async () => {
			var result = await con.validateProcessGraph(TESTPROCESSGGRAPH);
			expect(Array.isArray(result)).toBeTruthy();
			expect(result).toEqual([]);
		});

		test('Invalid process graph', async () => {
			var result = await con.validateProcessGraph({
				nodeId: {
					process_id: "unknown_process",
					arguments: {},
					result: true
				}
			});
			expect(Array.isArray(result)).toBeTruthy();
			expect(typeof result[0]).toBe('object');
			expect(result[0]).toHaveProperty('code');
			expect(result[0]).toHaveProperty('message');
		});
	});

	describe('Stored process graphs management', () => {
		var con;
		beforeAll(async () => {
			con = await connectWithBasicAuth();
			// clean up
			var list = await con.listProcessGraphs();
			await Promise.all(list.map(pg => pg.deleteProcessGraph()));
		});

		test('List process graphs', async () => {
			var pgs = await con.listProcessGraphs();
			expect(pgs).not.toBeNull();
			expect(pgs).toHaveLength(0);
		});

		var pg1;
		var pg2;
		test('Add process graph without metadata', async () => {
			var pg = await con.createProcessGraph(TESTPROCESSGGRAPH);
			expect(pg).not.toBeNull();
			expect(pg).not.toBeUndefined();
			expect(Object.getPrototypeOf(pg).constructor.name).toBe('ProcessGraph');
			expect(pg.connection).toBe(con);
			expect(pg.processGraphId).not.toBeNull();
			expect(pg.processGraphId).not.toBeUndefined();
			expect(pg.title).toBeNull();
			expect(pg.description).toBeNull();
			expect(pg.processGraph).toEqual(TESTPROCESSGGRAPH);
			pg1 = pg;
		});

		test('Make sure there is now 1 process graph, with no metadata', async () => {
			var pgs = await con.listProcessGraphs();
			expect(pgs).toHaveLength(1);
			expect(pgs[0]).not.toBeNull();
			expect(pgs[0]).not.toBeUndefined();
			expect(Object.getPrototypeOf(pgs[0]).constructor.name).toBe('ProcessGraph');
			expect(pgs[0].processGraphId).not.toBeNull();
			expect(pgs[0].processGraphId).toBe(pg1.processGraphId);
			expect(pgs[0].title).toBeNull();
			expect(pgs[0].description).toBeNull();
		});

		test('Add process graph with metadata', async () => {
			var pg = await con.createProcessGraph(TESTPROCESSGGRAPH, 'Test title', 'Test description');
			expect(pg).not.toBeNull();
			expect(pg).not.toBeUndefined();
			expect(Object.getPrototypeOf(pg).constructor.name).toBe('ProcessGraph');
			expect(pg.connection).toBe(con);
			expect(pg.processGraphId).not.toBeNull();
			expect(pg.processGraphId).not.toBe(pg1.processGraphId);
			expect(pg.title).toBe('Test title');
			expect(pg.description).toBe('Test description');
			expect(pg.processGraph).toEqual(TESTPROCESSGGRAPH);
			pg2 = pg;
		});

		test('Make sure there are now 2 process graphs, the second with metadata', async () => {
			var pgs = await con.listProcessGraphs();
			expect(pgs).toHaveLength(2);
			var pg = (pgs[0].processGraphId != pg1.processGraphId ? pgs[0] : pgs[1]);
			expect(pg).not.toBeNull();
			expect(pg).not.toBeUndefined();
			expect(Object.getPrototypeOf(pg).constructor.name).toBe('ProcessGraph');
			expect(pg.processGraphId).not.toBeNull();
			expect(pg.processGraphId).not.toBe(pg1.processGraphId);
			expect(pg.processGraphId).toBe(pg2.processGraphId);
			expect(pg.title).toBe('Test title')
			expect(pg.description).toBe('Test description');
			
		});

		test('Describe process graph without metadata', async () => {
			var pg = await pg1.describeProcessGraph();
			expect(pg).not.toBeNull();
			expect(pg).not.toBeUndefined();
			expect(pg.processGraphId).not.toBeNull();
			expect(pg.processGraphId).toBe(pg1.processGraphId);
			expect(pg.title).toBeNull();
			expect(pg.description).toBeNull();
		});

		test('Describe process graph with metadata', async () => {
			var pg = await pg2.describeProcessGraph();
			expect(pg).not.toBeNull();
			expect(pg).not.toBeUndefined();
			expect(pg.processGraphId).not.toBeNull();
			expect(pg.processGraphId).toBe(pg2.processGraphId);
			expect(pg.title).toBe('Test title');
			expect(pg.description).toBe('Test description');
		});

		test('Update process graph', async () => {
			await pg1.updateProcessGraph({title: 'Test title 2'});
			var pg = await pg1.describeProcessGraph();
			expect(pg).not.toBeNull();
			expect(pg).not.toBeUndefined();
			expect(pg.processGraphId).not.toBeNull();
			expect(pg.processGraphId).toBe(pg1.processGraphId);
			expect(pg.title).toBe('Test title 2');
			expect(pg.description).toBeNull();
		});

		test('Delete the second process graph', async () => {
			const success = await pg2.deleteProcessGraph();
			expect(success).toBeTruthy();
			
			var pgs = await con.listProcessGraphs();
			expect(pgs).toHaveLength(1);
			expect(pgs[0].processGraphId).toBe(pg1.processGraphId);
		});
	});

	describe('Sync. computation of results', () => {
		var con;
		beforeAll(async () => {
			con = await connectWithBasicAuth();
			// clean up
			var list = await con.listJobs();
			await Promise.all(list.map(j => j.deleteJob()));
		});

		test('Sync. compute a process graph result', async () => {
			var resource = await con.computeResult(TESTPROCESSGGRAPH, 'jpeg');
			expect(resource).not.toBeNull();
			if (isBrowserEnv) { // Browser environment
				expect(resource).toBeInstanceOf(Blob);
				// ToDo: Check blob content
			}
			else { // Node environment
				const stream = require('stream');
				expect(resource).toBeInstanceOf(stream.Readable);
				// ToDo: Check blob content
			}
		});
	});

	describe('Job management', () => {
		var con;
		beforeAll(async () => {
			con = await connectWithBasicAuth();
			// clean up
			var list = await con.listJobs();
			await Promise.all(list.map(j => j.deleteJob()));
		});

		test('List jobs in general', async () => {
			var jobs = await con.listJobs();
			expect(jobs).not.toBeNull();
			expect(jobs).toHaveLength(0);
		});

		var job;
		test('Add minimal job', async () => {
			job = await con.createJob(TESTPROCESSGGRAPH, 'jpeg');
			expect(Object.getPrototypeOf(job).constructor.name).toBe('Job');
			expect(job.jobId).not.toBeNull();
			expect(job.jobId).not.toBeUndefined();
			var jobs = await con.listJobs();
			expect(jobs).toHaveLength(1);
			expect(Object.getPrototypeOf(jobs[0]).constructor.name).toBe('Job');
			expect(jobs[0].jobId).toBe(job.jobId);
		});

		test('Describe job', async () => {
			var jobdetails = await job.describeJob();
			expect(jobdetails).not.toBeNull();
			expect(jobdetails).not.toBeUndefined();
			expect(jobdetails.jobId).toBe(job.jobId);
			expect(jobdetails.title).toBeNull();
			expect(jobdetails.status).toBe('submitted');
			expect(typeof jobdetails.submitted).toBe('string');
		});

		test('Update job', async () => {
			var success = await job.updateJob({title: 'Test job'});
			expect(success).toBeTruthy();
			var jobdetails = await job.describeJob();
			expect(jobdetails).not.toBeNull();
			expect(jobdetails).not.toBeUndefined();
			expect(jobdetails.jobId).toBe(job.jobId);
			expect(jobdetails.title).toBe('Test job');
			expect(typeof jobdetails.submitted).toBe('string');
		});

		test('Estimate job', async () => {
			// Not implemented by GEE back-end
			await expect(job.estimateJob()).rejects.toThrow();
		});
		  

		var targetFolder = Math.random().toString(36);
		test('Job Results', async () => {
			// Start job
			await expect(job.startJob()).resolves.toBeTruthy();
			var jobdetails = await job.describeJob();
			expect(jobdetails.status).toBe('queued');

			await waitForExpect(async () => {
				var jobdetails = await job.describeJob();
				expect(jobdetails.status).toBe('finished');

				// Get result list
				var res = await job.listResults();
				expect(res).not.toBeNull();
				expect(res).toHaveProperty("costs");
				expect(res).toHaveProperty("expires");
				expect(res).toHaveProperty("links");
				expect(res.links.length).toBeGreaterThan(0);
				expect(res.links[0]).toHaveProperty("href");

				// Download results
				if (isBrowserEnv) {
					// Browser environment
					await expect(job.downloadResults()).rejects.toThrow();
				}
				else {
					// Node environment
					// Create folder
					const fs = require('fs');
					expect(fs.existsSync(targetFolder)).toBeFalsy();
					fs.mkdirSync(targetFolder);
					expect(fs.existsSync(targetFolder)).toBeTruthy();
					// Get links to check against
					var res = await job.listResults();
					expect(res).not.toBeNull();
					expect(res).toHaveProperty("links");
					expect(res.links.length).toBeGreaterThan(0);
					// Download files
					var files = await job.downloadResults(targetFolder);
					expect(files.length).toBe(res.links.length);
					for(var i in files) {
						expect(fs.existsSync(files[i])).toBeTruthy();
					}
				}
			}, 50000, 2000);
		});

		test('Delete job', async () => {
			var success = await job.deleteJob();
			expect(success).toBeTruthy();
			var jobs = await con.listJobs();
			expect(jobs).toHaveLength(0);
		});

		afterAll(async () => {
			if (!isBrowserEnv) {
				// clean up
				const fs = require('fs');
				const path = require('path');
				var files = fs.readdirSync(targetFolder);
				files.map(file => {
					fs.unlinkSync(path.join(targetFolder, file));
				});
				fs.unlinkSync(targetFolder);
			}
		});
	});

	describe('Secondary Services management', () => {
		var con;
		beforeAll(async () => {
			con = await connectWithBasicAuth();
			// clean up
			var list = await con.listServices();
			await Promise.all(list.map(s => s.deleteService()));
		});

		test('List services in general', async () => {
			var svcs = await con.listServices();
			expect(svcs).not.toBeNull();
			expect(svcs).toHaveLength(0);
		});

		var svc;
		test('Add minimal service', async () => {
			svc = await con.createService(TESTPROCESSGGRAPH, 'xyz');
			expect(Object.getPrototypeOf(svc).constructor.name).toBe('Service');
			expect(svc.serviceId).not.toBeNull();
			expect(svc.serviceId).not.toBeUndefined();
			var svcs = await con.listServices();
			expect(svcs).toHaveLength(1);
			expect(Object.getPrototypeOf(svcs[0]).constructor.name).toBe('Service');
			expect(svcs[0].serviceId).toBe(svc.serviceId);
		});

		test('Describe service', async () => {
			var svcdetails = await svc.describeService();
			expect(svcdetails).not.toBeNull();
			expect(svcdetails).not.toBeUndefined();
			expect(svcdetails.serviceId).toBe(svc.serviceId);
			expect(svcdetails.title).toBeNull();
			expect(typeof svcdetails.url).toBe('string');
		})

		test('Update service', async () => {
			var success = await svc.updateService({title: 'Test service'});
			expect(success).toBeTruthy();
			var svcdetails = await svc.describeService();
			expect(svcdetails).not.toBeNull();
			expect(svcdetails).not.toBeUndefined();
			expect(svcdetails.serviceId).toBe(svc.serviceId);
			expect(svcdetails.title).toBe('Test service');
			expect(typeof svcdetails.url).toBe('string');
		});

		test('Delete service', async () => {
			var success = await svc.deleteService();
			expect(success).toBeTruthy();
			var svcs = await con.listServices();
			expect(svcs).toHaveLength(0);
		});
	});


	describe('File management', () => {
		var con, f;
		var fileContent = "Lorem ipsum";
		var fileName = "lorem.txt";
		beforeAll(async () => {
			con = await connectWithBasicAuth();
			// clean up
			var list = await con.listFiles();
			await Promise.all(list.map(f => f.deleteFile()));
			if (!isBrowserEnv) {
				const fs = require('fs');
				fs.writeFileSync(fileName, fileContent);
			}
		});

		test('List files in general', async () => {
			var files = await con.listFiles();
			expect(files).not.toBeNull();
			expect(files).toHaveLength(0);
		});

		var f;
		test('Upload file', async () => {
			f = await con.createFile(fileName);
			expect(Object.getPrototypeOf(f).constructor.name).toBe('File');
			expect(f.path).toBe(fileName);
			expect(f.userId).toBe(TESTUSERNAME);
			var files = await con.listFiles();
			expect(files).toHaveLength(0); // SIC!!! Zero! createFile only creates it locally
			await f.uploadFile(isBrowserEnv ? fileContent : fileName);
			var files = await con.listFiles();
			expect(files).toHaveLength(1); // now it should be there
			expect(Object.getPrototypeOf(files[0]).constructor.name).toBe('File');
			expect(files[0].path).toBe(f.path);
		});

		test('Get file contents', async (done) => {
			var resource = await f.downloadFile();
			expect(resource).not.toBeNull();
			if (isBrowserEnv) { // Browser environment
				expect(resource).toBeInstanceOf(Blob);
				var reader = new FileReader();
				reader.addEventListener("loadend", () => {
					// expect(...) can throw itself, so we have to wrap this assertion in try/catch.
					// Otherwise it could happen that done() is never called!
					try {
						expect(reader.result).toBe(fileContent);
						done();
					}
					catch(error) {
						console.log(error); // it's not being printed by expect itself
						done.fail();
					}
				});
				reader.readAsText(resource);
			}
			else { // Node environment
				const stream = require('stream');
				expect(resource).toBeInstanceOf(stream.Readable);

				const chunks = [];
				resource.on("data", function (chunk) {
					chunks.push(chunk);
				});
				resource.on("end", function () {
					expect(Buffer.concat(chunks).toString()).toBe(fileContent);
					done();
				});
			}
		});

		test('Download/Save file', async () => {
			var target = "downloaded_file.txt";
			if (isBrowserEnv) { 
				// Browser environment
				// Hard to test a browser download, ignore
				return;
			}
			else {
				// Node environment
				const fs = require('fs');
				// Make sure no old file exists
				if (fs.existsSync(target)) {
					fs.unlinkSync(target);
				}
				expect(fs.existsSync(target)).toBeFalsy();
				// Download file
				await f.downloadFile(target);
				expect(fs.existsSync(target)).toBeTruthy();
				expect(fs.readFileSync(target).toString()).toBe(fileContent);
			}
		})

		test('Update file being not supported', async () => {
			expect(f.updateFile).toBeUndefined();
			expect(f.replaceFile).toBeUndefined();
		});

		test('Delete file', async () => {
			var success = await f.deleteFile();
			expect(success).toBeTruthy();
			var files = await con.listFiles();
			expect(files).toHaveLength(0);
		});
	});

	describe('Subscriptions', () => {
		var fileName = 'randomnumber.txt';
		var prepareFile = async (f) => {
			var content = Math.random().toString(36);
			if (!isBrowserEnv) {
				const fs = require('fs');
				fs.writeFileSync(fileName, content);
				await f.uploadFile(fileName);
			}
			else {
				await f.uploadFile(content);
			}
			return content;
		}
		var con, f;

		beforeAll(async (done) => {
			con = await connectWithBasicAuth();
			f = await con.createFile(fileName);
			await prepareFile(f);
			done();
		});

		test('Subscribe to openeo.files', async (done) => {
			con.subscribe('openeo.files', {}, (payload, message) => {
				con.unsubscribe('openeo.files', {}); // Unsubscribe to avoid receiving the file delete message
//				expect(message.issued).toBe(... an ISO datetime string);
				expect(message.topic).toBe('openeo.files');
				expect(payload.user_id).toBe(TESTUSERNAME);
				expect(payload.path).toBe(fileName);
				expect(payload.action).toBe('updated');
				done();
			});
			// Upload files every second to ensure a message is sent by the server during the test.
			await waitForExpect(async () => {
				await prepareFile(f);
			}, 50000, 2000);
		});

		afterAll(async (done) => {
			await f.deleteFile();
			done();
		});
	});

});
