function ElasticClient(host,username,password) {
	this.host = host;
	this.username = username;
	this.password = password;
	
	this.createIndex=function(name, settings, callback_success, callback_error) {
		this.syncRequest('POST', "/" + name, settings, callback_success, callback_error);
	}

	this.enableShardAllocation=function(callback_success, callback_error) {
		var new_settings = {"transient":{ "cluster.routing.allocation.disable_allocation":false }};
		this.syncRequest('PUT', "/_cluster/settings",JSON.stringify(new_settings, undefined, ""), callback_success, callback_error);
	}

	this.disableShardAllocation=function(callback_success, callback_error) {
		var new_settings = {"transient":{ "cluster.routing.allocation.disable_allocation":true }};
		this.syncRequest('PUT', "/_cluster/settings",JSON.stringify(new_settings, undefined, ""), callback_success, callback_error);
	}

	this.getClusterState=function(callback_success, callback_error) {
		this.syncRequest('GET', "/_cluster/state",{}, callback_success, callback_error);
	}

	this.shutdownNode=function(node_id, callback_success, callback_error) {
		this.syncRequest('POST', "/_cluster/nodes/" + node_id + "/_shutdown", {}, callback_success, callback_error);
	}

	this.openIndex=function(index, callback_success, callback_error) {
		this.syncRequest('POST', "/" + index + "/_open", {}, callback_success, callback_error);
	}

	this.optimizeIndex=function(index, callback_success, callback_error) {
		this.syncRequest('POST', "/" + index + "/_optimize", {}, callback_success, callback_error);
	}

	this.clearCache=function(index, callback_success, callback_error) {
		this.syncRequest('POST', "/" + index + "/_cache/clear", {}, callback_success, callback_error);
	}

	this.closeIndex=function(index, callback_success, callback_error) {
		this.syncRequest('POST', "/" + index + "/_close", {}, callback_success, callback_error);
	}

	this.refreshIndex=function(index, callback_success, callback_error) {
		this.syncRequest('POST', "/" + index + "/_refresh", {}, callback_success, callback_error);
	}

	this.deleteIndex=function(name, callback_success, callback_error) {
		this.syncRequest('DELETE', "/" + name, {}, callback_success, callback_error);
	}

	this.updateIndexSettings=function(name, settings, callback_success, callback_error) {
		this.syncRequest('PUT', "/" + name + "/_settings", settings, callback_success, callback_error);
	}

	this.updateClusterSettings=function(settings, callback_success, callback_error) {
		this.syncRequest('PUT', "/_cluster/settings", settings, callback_success, callback_error);
	}

	this.getNodes=function(callback_success, callback_error) {
		var nodes = [];
		var createNodes = function(response) {
			Object.keys(response.response['nodes']).forEach(function(node_id) {
				nodes.push(new Node(node_id,response.response['nodes'][node_id]));
			});
			callback_success(nodes);
		}
		this.syncRequest('GET', "/_cluster/state", {}, createNodes, callback_error);
	}

	this.fetchAliases=function(callback_success, callback_error) {
		var createAliases=function(response) {
			callback_success(new Aliases(response));
		}
		this.syncRequest('GET', "/_aliases",{},createAliases, callback_error);
	}

	this.analyzeByField=function(index, type, field, text, callback_success, callback_error) {
		var buildTokens=function(response) {
			var tokens = response['tokens'].map(function (token) {
				return new Token(token['token'],token['start_offset'],token['end_offset'],token['position']);
			});
			callback_success(tokens);	
		}
		this.syncRequest('GET', "/" + index + "/_analyze?field=" + type +"."+field,{'text':text}, buildTokens, callback_error);
	}

	this.analyzeByAnalyzer=function(index, analyzer, text, callback_success, callback_error) {
		var buildTokens=function(response) {
			var tokens = response['tokens'].map(function (token) {
				return new Token(token['token'],token['start_offset'],token['end_offset'],token['position']);
			});
			callback_success(tokens);	
		}
		this.syncRequest('GET', "/" + index + "/_analyze?analyzer=" + analyzer,{'text':text}, buildTokens, callback_error);
	}

	this.updateAliases=function(add_aliases,remove_aliases, callback_success, callback_error) {
		var data = {};
		if (add_aliases.length == 0 && remove_aliases.length == 0) {
			throw "No changes were made: nothing to save";
		}
		data['actions'] = [];
		remove_aliases.forEach(function(alias) {
			data['actions'].push({'remove':alias.info()});
		});
		add_aliases.forEach(function(alias) {
			data['actions'].push({'add':alias.info()});
		});
		this.syncRequest('POST', "/_aliases",JSON.stringify(data, undefined, ""), callback_success, callback_error);
		
	}

	this.getNodesStats=function(callback_success, callback_error) {
		this.syncRequest('GET', "/_nodes/stats?all=true",{},callback_success, callback_error);
	}
	
	this.getIndexWarmers=function(index, warmer, callback_success, callback_error) {
		var path = "/" + index + "/_warmer/" + warmer.trim();
		this.syncRequest('GET', path ,{},callback_success, callback_error);
	}
	
	this.deleteWarmupQuery=function(index, warmer, callback_success, callback_error) {
		var path = "/" + index + "/_warmer/" + warmer;
		this.syncRequest('DELETE', path, {},callback_success, callback_error);
	}
	
	this.registerWarmupQuery=function(index, types, warmer_id, source, callback_success, callback_error) {
		var path = "/" + index + "/";
		if (types != null && types.trim().length > 0) {
			path += types + "/";
		}
		path += "/_warmer/" + warmer_id.trim();
		this.syncRequest('PUT', path ,source,callback_success, callback_error);
	}
	
	this.fetchPercolateQueries=function(index, body, callback_success, callback_error) {
		var path = index != null ? "/_percolator/" + index + "/_search" : "/_percolator/_search";
		this.syncRequest('POST', path , body,callback_success, callback_error);
	}
	
	this.deletePercolatorQuery=function(index, id, callback_success, callback_error) {
		this.syncRequest('DELETE', "/_percolator/" + index + "/" + id, {}, callback_success, callback_error);
	}
	
	this.createPercolatorQuery=function(index, id, body, callback_success, callback_error) {
		this.syncRequest('PUT', "/_percolator/" + index + "/" + id, body, callback_success, callback_error);
	}
	
	this.syncRequest=function(method, path, data, callback_success, callback_error) {
		var url = this.host + path;
		this.executeRequest(method,url,this.username,this.password, data, callback_success, callback_error);
	}
	
	this.createAuthToken=function(username,password) {
		var auth = null;
		if (username != null && password != null) {
			auth = "Basic " + window.btoa(username + ":" + password);
		}
		return auth;
	}
	
	this.executeRequest=function(method, url, username, password, data, callback_success, callback_error) {
		var auth = this.createAuthToken(username,password);
		$.when(
			$.ajax({
				type: method,
				url: url,
				dataType: 'json',
				beforeSend: function(xhr) { 
					if (auth != null) {
						xhr.setRequestHeader("Authorization", auth);
					} 
				},
				data: data
		})).then(
			function(r) { 
				callback_success(r); 
			},
			function(error) {
				callback_error(error); 
			}
		 );
	}

	/** ####### END OF REFACTORED AREA ####### **/

	this.getClusterHealth=function(callback_success, callback_error) {
		var url = this.host + "/_cluster/health";
		var auth = this.createAuthToken(this.username,this.password);
		$.when(
			$.ajax({ 
				type: 'GET',
				url: url,
				dataType: 'json',
				data: {},
				beforeSend: function(xhr) { 
					if (auth != null) {
						xhr.setRequestHeader("Authorization", auth);
					} 
				},
			})).then(
				function(cluster_health) {
					callback_success(new ClusterHealth(cluster_health));
				},
				function(cluster_health) {
					callback_error(cluster_health);
				}
		);
	}

	this.getClusterDetail=function(callback_success, callback_error) {
		var host = this.host;
		var auth = this.createAuthToken(this.username,this.password);
		$.when(
			$.ajax({ 
				type: 'GET', 
				url: host+"/_cluster/state", 
				dataType: 'json', 
				data: {},
				beforeSend: function(xhr) { 
					if (auth != null) {
						xhr.setRequestHeader("Authorization", auth);
					} 
				}
			}),
			$.ajax({ 
				type: 'GET', 
				url: host+"/_cluster/nodes/stats?all=true", 
				dataType: 'json', 
				data: {}, 
				beforeSend: function(xhr) { 
					if (auth != null) {
						xhr.setRequestHeader("Authorization", auth);
					} 
				}
			}),
			$.ajax({ 
				type: 'GET', 
				url: host+"/_status", 
				dataType: 'json', 
				data: {}, 
				beforeSend: function(xhr) { 
					if (auth != null) {
						xhr.setRequestHeader("Authorization", auth);
					}
				}
			}),
			$.ajax({ 
				type: 'GET', 
				url: host+"/_cluster/settings", 
				dataType: 'json', 
				data: {}, 
				beforeSend: function(xhr) { 
					if (auth != null) {
						xhr.setRequestHeader("Authorization", auth);
					} 
				}
			})
		).then(
			function(cluster_state,nodes_stats,cluster_status,settings) {
				callback_success(new Cluster(cluster_state[0],cluster_status[0],nodes_stats[0],settings[0]));
			},
			function(error) {
				callback_error(error);
			}
		);
	} 

	this.getClusterDiagnosis=function(callback_success,callback_error) {
		var host = this.host;
		var auth = this.createAuthToken(this.username,this.password);
		$.when(
			$.ajax({ 
				type: 'GET', 
				url: host+"/_cluster/state", 
				dataType: 'json', 
				data: {},
				beforeSend: function(xhr) { 
					if (auth != null) {
						xhr.setRequestHeader("Authorization", auth);
					} 
				}
			}),
			$.ajax({ 
				type: 'GET', 
				url: host+"/_cluster/nodes/stats?all=true", 
				dataType: 'json', 
				data: {},
				beforeSend: function(xhr) { 
					if (auth != null) {
						xhr.setRequestHeader("Authorization", auth);
					} 
				}
			}),
			$.ajax({ 
				type: 'GET', 
				url: host+"/_nodes/hot_threads", 
				data: {},
				beforeSend: function(xhr) { 
					if (auth != null) {
						xhr.setRequestHeader("Authorization", auth);
					} 
				}
			})
		).then(
				function(state, stats, hot_threads) {
					callback_success(state[0], stats[0], hot_threads[0]);
				},
				function(failed_request) {
					callback_error(failed_request);
				}
			);
	}
}

/** TYPES **/
function Token(token, start_offset, end_offset, position) {
	this.token = token;
	this.start_offset = start_offset;
	this.end_offset = end_offset;
	this.position = position;
}

function ClusterHealth(health) {
	this.status = health['status'];
	this.name = health['cluster_name'];
}

function Aliases(aliases_info) {
	var indices  = [];
	var aliases_map = {};
	Object.keys(aliases_info).forEach(function(index) {
		indices.push(index); // fills list of available indices
		var indexAliases = aliases_info[index]['aliases'];
		Object.keys(indexAliases).forEach(function(alias) { // group aliases per alias name
			if (!isDefined(aliases_map[alias])) {
				aliases_map[alias] = [];
			}
			var alias_instance = new Alias(alias, index, indexAliases[alias]['filter'], indexAliases[alias]['index_routing'],indexAliases[alias]['search_routing']);
			aliases_map[alias].push(alias_instance);
		});
	});
	this.indices = indices;
	this.info = aliases_map;
}

function Alias(alias, index, filter, index_routing, search_routing) {
	this.alias = alias != null ? alias.toLowerCase() : "";
	this.index = index != null ? index.toLowerCase() : "";
	this.filter = filter;
	this.index_routing = index_routing;
	this.search_routing = search_routing;

	this.validate=function() {
		if (this.alias == null || this.alias.trim().length == 0) {
			throw "Alias must have a non empty name";
		}
		if (this.index == null || this.index.trim().length == 0) {
			throw "Alias must have a valid index name";
		}
	}

	this.equals=function(other_alias) {
		var equal = 
		(this.alias === other_alias.alias) &&
		(this.index === other_alias.index) &&
		(this.filter === other_alias.filter) &&
		(this.index_routing === other_alias.index_routing) &&
		(this.search_routing === other_alias.search_routing);
		return equal;
	}

	this.info=function() {
		var info = {};
		info['index'] = this.index;
		info['alias'] = this.alias;
	
		if (this.filter != null) {
			if (typeof this.filter == 'string' && this.filter.trim().length > 0) {
				info['filter'] = JSON.parse(this.filter);
			} else {
				info['filter'] = this.filter;
			}
		}
		if (this.index_routing != null && this.index_routing.trim().length > 0) {
			info['index_routing'] = this.index_routing;
		}
		if (this.search_routing != null && this.search_routing.trim().length > 0) {
			info['search_routing'] = this.search_routing;
		}
		return info; 
	}
}

function Node(node_id, node_info, node_stats) {
	this.id = node_id;	
	this.name = node_info['name'];
	this.metadata = {};
	this.metadata['info'] = node_info;
	this.metadata['stats'] = node_stats;
	this.transport_address = node_info['transport_address'];
	var master = node_info['attributes']['master'] === 'false' ? false : true;
	var data = node_info['attributes']['data'] === 'false' ? false : true;
	var client = node_info['attributes']['client'] === 'true' ? true : false;
	this.master =  master && !client;
	this.data = data && !client;
	this.client = client || !master && !data;
	this.current_master = false;
	this.stats = node_stats;

	this.setCurrentMaster=function() {
		this.current_master = true;
	}
	
	this.compare=function(other) { // TODO: take into account node specs?
		if (other.current_master) {
			return 1;
		}
		if (this.current_master) {
			return -1;
		}
		if (other.master && !this.master) {
			return 1;
		} 
		if (this.master && !other.master) {
			return -1;
		}

		if (other.data && !this.data) {
			return 1;
		} 
		if (this.data && !other.data) {
			return -1;
		}
		return this.name.localeCompare(other.name);
	}
}

function Shard(shard_info) {
	this.info = shard_info;
	this.primary = shard_info.routing.primary;
	this.shard = shard_info.routing.shard;
	this.state = shard_info.routing.state;
	this.node = shard_info.routing.node;
	this.index = shard_info.routing.index;
	this.id = this.node + "_" + this.shard + "_" + this.index;
}

function Cluster(state,status,nodes,settings) {
	if (state != null && status != null && nodes != null && settings != null) {
		this.disableAllocation = false;
		if (isDefined(settings['persistent']) && isDefined(settings['persistent']['disable_allocation'])) {
			this.disableAllocation = settings['persistent']['disable_allocation'] == "true" ? true : false;
		}
		if (isDefined(settings['transient']) && isDefined(settings['transient']['cluster.routing.allocation.disable_allocation'])) {
			this.disableAllocation = settings['transient']['cluster.routing.allocation.disable_allocation'] == "true" ? true : false;
		}
		this.settings = $.extend({}, settings['persistent'], settings['transient']);
		this.master_node = state['master_node'];
		var num_nodes = 0;
		this.nodes = Object.keys(state['nodes']).map(function(x) { 
			var node = new Node(x,state['nodes'][x],nodes['nodes'][x]);
			num_nodes += 1;
			if (node.id === state['master_node']) {
				node.setCurrentMaster();
			}
			return node;
		}).sort(function(a,b) { return a.compare(b) });
    	this.number_of_nodes = num_nodes;
		var iMetadata = state['metadata']['indices'];
		var iRoutingTable = state['routing_table']['indices'];
		var iStatus = status['indices'];
		var count = 0;
		var unassigned_shards = 0;
		var total_size = 0;
		var num_docs = 0;
		this.indices = Object.keys(iMetadata).map(
			function(x) { 
				var index = new Index(x,iRoutingTable[x], iMetadata[x], iStatus[x]);
				unassigned_shards += index.unassigned.length;
				total_size += parseInt(index.total_size);
				num_docs += index.num_docs;
				return index;
			 }
		).sort(function(a,b) { return a.compare(b) });
		this.num_docs = num_docs;
		this.unassigned_shards = unassigned_shards;
		this.total_indices = this.indices.length;
		this.shards = status['_shards']['total'];
		this.failed_shards = status['_shards']['failed'];
		this.successful_shards = status['_shards']['successful'];
		this.total_size = total_size;
		this.getNodes=function(name, data, master, client) { 
			return $.map(this.nodes,function(n) {
				if (name.trim().length > 0 && n.name.toLowerCase().indexOf(name.trim().toLowerCase()) == -1) {
					return null;
				} 
				return (data && n.data || master && n.master || client && n.client) ? n : null;
			});
		};
	}
}

function Index(index_name,index_info, index_metadata, index_status) {
	this.name = index_name;
	var index_shards = {};
	this.shards = index_shards;
	this.state = index_metadata['state'];
	this.metadata = {};
	this.aliases = index_metadata['aliases'];
	this.total_aliases = isDefined(index_metadata['aliases']) ? index_metadata['aliases'].length : 0;
	this.visibleAliases=function() {
		return this.total_aliases > 5 ? this.aliases.slice(0,5) : this.aliases;
	}
	this.settings = index_metadata['settings'];
	this.mappings = index_metadata['mappings'];
	this.metadata['settings'] = this.settings;
	this.metadata['mappings'] = this.mappings;
	this.num_of_shards = index_metadata['settings']['index.number_of_shards'];
	this.num_of_replicas = parseInt(index_metadata['settings']['index.number_of_replicas']);
	this.state_class = index_metadata['state'] === "open" ? "success" : "active";
	this.visible = true;
	var unassigned = [];

	// adds shard information
	if (typeof index_status != 'undefined') {
		$.map(index_status.shards, function(shards, shard_num) {
			$.map(shards, function(shard_info, shard_copy) {
				if (typeof index_shards[shard_info.routing.node] === 'undefined') {
					index_shards[shard_info.routing.node] = [];
				}
				index_shards[shard_info.routing.node].push(new Shard(shard_info));
			});
		});
		this.metadata['stats'] = index_status
	}
	// adds unassigned shards information
	if (index_info) {
  		Object.keys(index_info['shards']).forEach(function(x) { 
  			var shards_info = index_info['shards'][x];
			shards_info.forEach(function(shard_info) {
				if (shard_info['state'] === 'UNASSIGNED') {
					unassigned.push(shard_info['shard']);	
				}
			});
  		});
	}


	this.unassigned = unassigned;
	var has_status = this.state === 'open' && (typeof index_status != 'undefined')
	this.num_docs = has_status ? index_status['docs']['num_docs'] : 0;
	this.max_doc = has_status ? index_status['docs']['max_doc'] : 0;
	this.deleted_docs = has_status ? index_status['docs']['deleted_docs'] : 0;
	this.size = has_status ? index_status['index']['primary_size_in_bytes'] : 0;
	this.total_size = has_status ? index_status['index']['size_in_bytes'] : 0;
	this.settingsAsString=function() {
		return hierachyJson(JSON.stringify(this.settings, undefined, ""));
	}
	this.compare=function(b) { // TODO: take into account index properties?
		return this.name.localeCompare(b.name);
	}
	
	this.getTypes=function() {
		return Object.keys(this.mappings);
	}
	
	this.getAnalyzers=function() {
		var analyzers = [];
		Object.keys(this.settings).forEach(function(setting) {
			if (setting.indexOf('index.analysis.analyzer') == 0) {
				var analyzer = setting.substring('index.analysis.analyzer.'.length);
				analyzer = analyzer.substring(0,analyzer.indexOf("."));
				if ($.inArray(analyzer, analyzers) == -1) {
					analyzers.push(analyzer);
				}
			}
		});
		return analyzers;
	}
	
	this.getFields=function(type) {
		if (isDefined(this.mappings[type])) {
			return Object.keys(this.mappings[type]['properties']);
		} else {
			return [];
		}
	}
	
}

function ClusterState(cluster_state) {
	var start = new Date().getTime();
	
	this.getIndices=function() {
		return Object.keys(this.indices);
	}
	
	this.getTypes=function(index) {
		if (typeof this.indices[index] != 'undefined') {
			return Object.keys(this.indices[index]['types']);
		}
	}
	
	this.getAnalyzers=function(index) {
		if (typeof this.indices[index] != 'undefined') {
			return this.indices[index]['analyzers'];
		}
	}
	
	this.getFields=function(index, type) {
		if (typeof this.indices[index] != 'undefined') {
			return this.indices[index]['types'][type];
		}
	} 
	
	var indices = {};
	
	Object.keys(cluster_state['metadata']['indices']).forEach(function(index) {
		indices[index] = {};
		var indexData = cluster_state['metadata']['indices'][index]['mappings'];
		indices[index]['types'] = {};
		Object.keys(indexData).forEach(function(type) {
			indices[index]['types'][type] = [];
			Object.keys(indexData[type]['properties']).forEach(function(property) {
				indices[index]['types'][type].push(property);
			});
		});
		var indexSettings = cluster_state['metadata']['indices'][index]['settings'];
		indices[index]['analyzers'] = [];
		Object.keys(indexSettings).forEach(function(setting) {
			if (setting.indexOf('index.analysis.analyzer') == 0) {
				var analyzer = setting.substring('index.analysis.analyzer.'.length);
				analyzer = analyzer.substring(0,analyzer.indexOf("."));
				if ($.inArray(analyzer, indices[index]['analyzers']) == -1) {
					indices[index]['analyzers'].push(analyzer);
				}
			}
		});
	});
	
	this.indices = indices;
}
var jsonTree = new JSONTree();

function getTimeString(date) {
	date = date == null ? new Date() : date; 
	return ('0' + date.getHours()).slice(-2) + ":" + ('0' + date.getMinutes()).slice(-2) + ":" + ('0' + date.getSeconds()).slice(-2);
}

function Request(url, method, body) {
	this.timestamp = getTimeString();
	this.url = url;
	this.method = method;
	this.body = body;
	
	this.clear=function() {
		this.url = '';
		this.method = '';
		this.body = '';
	}
}

var Alert=function(message, response) {
	this.message = message;
	this.response = response;

}

Alert.prototype = {
	getResponse:function() {
		if (this.response != null) {
			return JSON.stringify(this.response, undefined, 2);			
		}
	},
	hasServerResponse:function() {
		return this.response != null;
	},
	clear:function() {
		this.level = null;
		this.message = null;
		this.class = null;
	}
};

var SuccessAlert=function(message, response) {
	this.message = message;
	this.level = "success";
	this.class = "alert-success";
	this.icon = "icon-ok";
	this.response = response;
}
SuccessAlert.prototype = new Alert();
SuccessAlert.prototype.constructor = SuccessAlert;

var ErrorAlert=function(message, response) {
	this.message = message;
	this.level = "error";
	this.class = 'alert-danger';
	this.icon = "icon-warning-sign";
	this.response = response;
}
ErrorAlert.prototype = new Alert();
ErrorAlert.prototype.constructor = ErrorAlert;

var InfoAlert=function(message, response) {
	this.message = message;
	this.level = "info";
	this.class = 'alert-info';
	this.icon = "icon-info";
	this.response = response;
}
InfoAlert.prototype = new Alert();
InfoAlert.prototype.constructor = InfoAlert;

function AliasesPagination(page, results) {
	this.page = page;
	this.page_size = 10;
	this.results = results;
	this.alias_query = "";
	this.index_query = "";
	this.past_alias_query = null;
	this.past_index_query = null;
	this.total = 0;
	this.cached_results = null;
	
	this.firstResult=function() {
		if (Object.keys(this.getResults()).length > 0) {
			return ((this.current_page() - 1) * this.page_size) + 1;
		} else {
			return 0;
		}
	}
	
	this.lastResult=function() {
		if (this.current_page() * this.page_size > Object.keys(this.getResults()).length) {
			return Object.keys(this.getResults()).length;
		} else {
			return this.current_page() * this.page_size;
		}
	}

	this.hasNextPage=function() {
		return this.page_size * this.current_page() < Object.keys(this.getResults()).length;
	}
	
	this.hasPreviousPage=function() {
		return this.current_page() > 1;
	}
	this.nextPage=function() {
		this.page += 1;
	}
	this.previousPage=function() {
		this.page -= 1;
	}
	
	this.current_page=function() {
		if (this.alias_query != this.past_alias_query || this.index_query != this.past_index_query) {
			this.page = 1;
		}
		return this.page;
	}
	
	this.getPage=function() {
		var count = 1;
		var first_result = this.firstResult();
		var last_result = this.lastResult();
		var page = {};
		var results = this.getResults();
		Object.keys(results).forEach(function(alias) {
			if (count < first_result || count > last_result) {
				count += 1;
			} else {
				count += 1;
				page[alias] = results[alias];
			}
		});
		return page;
	}
	
	this.setResults=function(results) {
		this.results = results;
		// forces recalculation of page
		this.cached_results = null; 
	}
	
	this.total=function() {
		return Object.keys(this.getResults()).length;
	}
	
	this.getResults=function() {
		var matchingResults = {};
		var filters_changed = (this.alias_query != this.past_alias_query || this.index_query != this.past_index_query);
		if (filters_changed || this.cached_results == null) { // if filters changed or no cached, calculate
			var alias_query = this.alias_query;
			var index_query = this.index_query;
			var results = this.results;
			Object.keys(results).forEach(function(alias_name) {
				if (isDefined(alias_query) && alias_query.length > 0) {
					if (alias_name.indexOf(alias_query) != -1) {
						if (isDefined(index_query) && index_query.length > 0) {
							results[alias_name].forEach(function(alias) {
								if (alias.index.indexOf(index_query) != -1) {
									matchingResults[alias_name] = results[alias_name];
								}
							});
						} else {
							matchingResults[alias_name] = results[alias_name];
						}
					} 
				} else {
					if (isDefined(index_query) && index_query.length > 0) {
						results[alias_name].forEach(function(alias) {
							if (alias.index.indexOf(index_query) != -1) {
								matchingResults[alias_name] = results[alias_name];
							}
						});
					} else {
						matchingResults[alias_name] = results[alias_name];
					}
				}
			});
			this.cached_results = matchingResults;
			this.past_alias_query = this.alias_query;
			this.past_index_query = this.index_query;
		}
		return this.cached_results;
	}
}

function Pagination(page, query, results) {
	this.page = page;
	this.page_size = 4;
	this.results = results;
	this.query = query;
	this.data = true;
	this.master = true;
	this.client = true;
	this.state = "";
	this.node_name = "";
	
	this.firstResult=function() {
		if (this.getResults().length > 0) {
			return ((this.current_page() - 1) * this.page_size) + 1;
		} else {
			return 0;
		}
	}
	
	this.lastResult=function() {
		if (this.current_page() * this.page_size > this.getResults().length) {
			return this.getResults().length;
		} else {
			return this.current_page() * this.page_size;
		}
	}

	this.hasNextPage=function() {
		return this.page_size * this.current_page() < this.getResults().length;
	}
	
	this.hasPreviousPage=function() {
		return this.current_page() > 1;
	}
	this.nextPage=function() {
		this.page += 1;
	}
	this.previousPage=function() {
		this.page -= 1;
	}
	
	this.total=function() {
		return this.getResults().length;
	}
	
	this.current_page=function() {
		if (this.query != this.previous_query) {
			this.previous_query = this.query;
			this.page = 1;
		}
		return this.page;
	}
	
	this.getPage=function() {
		var count = 1;
		var first_result = this.firstResult();
		var last_result = this.lastResult();
		var page = $.map(this.getResults(),function(i) {
			if (count < first_result || count > last_result) {
				count += 1;
				return null;
			}
			count += 1;
			return i;
		});
		return page;
	}
	
	this.setResults=function(results) {
		this.results = results;
	}
	
	this.getResults=function() {
		var query = this.query;
		var state = this.state;
		return $.map(this.results,function(i) {
			if (isDefined(query) && query.length > 0) {
				if (i.name.toLowerCase().indexOf(query.trim().toLowerCase()) == -1) {
					return null;
				} 
			}
			if (state.length > 0 && state != i.state) {
				return null;
			} 
			return i;
		});
	}
}

function ModalControls() {
	this.alert = null;
	this.active = false;
	this.title = '';
	this.info = '';
}

function isDefined(value) {
	return typeof value != 'undefined';
}

function notEmpty(value) {
	return isDefined(value) && value != null && value.trim().length > 0;
}

function hierachyJson(json) {
	var jsonObject = JSON.parse(json);
	var resultObject = {};
	Object.keys(jsonObject).forEach(function(key) {
		var parts = key.split(".");
		var property = null;
		var reference = resultObject;
		var previous = null;
		for (var i = 0; i<parts.length; i++) {
			if (i == parts.length - 1) {
				if (isNaN(parts[i])) {
					reference[parts[i]] = jsonObject[key];	
				} else {
					if (!(previous[property] instanceof Array)) {
						previous[property] = [];
					}
					previous[property].push(jsonObject[key]);
				}
			} else {
				property = parts[i];
				if (!isDefined(reference[property])) {
					reference[property] = {};
				}
				previous = reference;
				reference = reference[property];
			}
		}
	});
	return JSON.stringify(resultObject,undefined,4);
}
var kopf = angular.module('kopf', []);

kopf.factory('IndexSettingsService', function() {
	return {index: null};
});

kopf.factory('ClusterSettingsService', function() {
	return {cluster: null};
});

// manages behavior of confirmation dialog
kopf.factory('ConfirmDialogService', function() {
	this.header = "Default Header";
	this.body = "Default Body";
	this.cancel_text = "cancel";
	this.confirm_text = "confirm";
	
	this.confirm=function() {
		// when created, does nothing
	}
	
	this.close=function() {
		// when created, does nothing		
	}
	
	this.open=function(header, body, action, confirm_callback, close_callback) {
		this.header = header;
		this.body = body;
		this.action = action;
		this.confirm = confirm_callback;
		this.close = close_callback;
	}
	
	return this;
});

function AliasesController($scope, $location, $timeout, AlertService) {
	$scope.aliases = null;
	$scope.new_index = {};
	$scope.pagination= new AliasesPagination(1, []);
	$scope.alert_service = AlertService;
	
	$scope.editor = new AceEditor('alias-filter-editor');
	
	$scope.viewDetails=function(alias) {
		$scope.details = alias;
	}

	$scope.addAlias=function() {
		$scope.new_alias.filter = $scope.editor.format();
		if ($scope.editor.error == null) {
			try {
				$scope.new_alias.validate();
				// if alias already exists, check if its already associated with index
				if (isDefined($scope.aliases.info[$scope.new_alias.alias])) { 
					var aliases = $scope.aliases.info[$scope.new_alias.alias];
					$.each(aliases,function(i, alias) {
						if (alias.index === $scope.new_alias.index) {
							throw "Alias is already associated with this index";
						} 
					});
				} else { 
					$scope.aliases.info[$scope.new_alias.alias] = [];
				}
				$scope.aliases.info[$scope.new_alias.alias].push($scope.new_alias);
				$scope.new_alias = new Alias();
				$scope.pagination.setResults($scope.aliases.info);
				$scope.alert_service.success("Alias successfully added. Note that changes made will only be persisted after saving changes");
			} catch (error) {
				$scope.alert_service.error(error ,null);
			}
		} else {
			$scope.alert_service.error("Invalid filter defined for alias" , $scope.editor.error);
		}
	}
	
	$scope.removeAlias=function(alias) {
		delete $scope.aliases.info[alias];
		$scope.pagination.setResults($scope.aliases.info);
		$scope.alert_service.success("Alias successfully removed. Note that changes made will only be persisted after saving changes");
	}
	
	$scope.removeAliasFromIndex=function(index, alias_name) {
		var aliases = $scope.aliases.info[alias_name];
		for (var i = 0; i < aliases.length; i++) {
			if (alias_name === aliases[i].alias && index === aliases[i].index) {
				$scope.aliases.info[alias_name].splice(i,1);
				$scope.alert_service.success("Alias successfully dissociated from index. Note that changes made will only be persisted after saving changes");
			}
		}
	}
	
	$scope.mergeAliases=function() {
		var deletes = [];
		var adds = [];
		Object.keys($scope.aliases.info).forEach(function(alias_name) {
			var aliases = $scope.aliases.info[alias_name];
			aliases.forEach(function(alias) {
				// if alias didnt exist, just add it
				if (!isDefined($scope.originalAliases.info[alias_name])) { 
					adds.push(alias);
				} else { 
					var originalAliases = $scope.originalAliases.info[alias_name];
					var addAlias = true;
					for (var i = 0; i < originalAliases.length; i++) {
						if (originalAliases[i].equals(alias)) {
							addAlias = false;
							break;
						}
					}
					if (addAlias) {
						adds.push(alias);
					}
				} 
			});
		});
		Object.keys($scope.originalAliases.info).forEach(function(alias_name) {
			var aliases = $scope.originalAliases.info[alias_name];
			aliases.forEach(function(alias) {
				if (!isDefined($scope.aliases.info[alias.alias])) {
					deletes.push(alias);
				} else {
					var newAliases = $scope.aliases.info[alias_name];
					var removeAlias = true;
					for (var i = 0; i < newAliases.length; i++) {
						if (alias.index === newAliases[i].index && alias.equals(newAliases[i])) {
							removeAlias = false;
							break;
						}
					}
					if (removeAlias) {
						deletes.push(alias);
					}
				}
			});
		});
		$scope.client.updateAliases(adds,deletes, 
			function(response) {
				$scope.loadAliases();
				$scope.alert_service.success("Aliases were successfully updated",response);
			},
			function(error) {
				$scope.alert_service.error("Error while updating aliases",error);
			}
		);
	}
	
	$scope.loadAliases=function() {
		$scope.new_alias = new Alias();
		$scope.client.fetchAliases(
			function(aliases) {
				$scope.originalAliases = aliases;
				$scope.aliases = jQuery.extend(true, {}, $scope.originalAliases);
				$scope.pagination.setResults($scope.aliases.info);
			},
			function(error) {
				$scope.alert_service.error("Error while fetching aliases",error);		
			}
		);
	}
	
	$scope.$on('hostChanged',function() {
		$scope.loadAliases();
	});
	
    $scope.$on('loadAliasesEvent', function() {
		$scope.loadAliases();
    });

}
function AnalysisController($scope, $location, $timeout, AlertService, ClusterSettingsService) {
	$scope.indices = null;
	$scope.alert_service = AlertService;
	$scope.cluster_service = ClusterSettingsService;

	// by index
	$scope.field_index = null;
	$scope.field_type = '';
	$scope.field_field = '';
	$scope.field_text = '';
	$scope.field_tokens = [];
	
	// By analyzer
	$scope.analyzer_index = '';
	$scope.analyzer_analyzer = '';
	$scope.analyzer_text = '';
	$scope.analyzer_tokens = [];
	
	$scope.analyzeByField=function() {
		if ($scope.field_field.length > 0 && $scope.field_text.length > 0) {
			$scope.field_tokens = null;
			$scope.client.analyzeByField($scope.field_index.name,$scope.field_type,$scope.field_field,$scope.field_text, 
				function(response) {
					$scope.field_tokens = response;
				},
				function(error) {
					$scope.field_tokens = null;
					$scope.alert_service.error("Error while analyzing text", error);
				}
			);
		}
	}
	
	$scope.analyzeByAnalyzer=function() {
		if ($scope.analyzer_analyzer.length > 0 && $scope.analyzer_text.length > 0) {
			$scope.field_tokens = null;
			$scope.analyzer_tokens = $scope.client.analyzeByAnalyzer($scope.analyzer_index.name,$scope.analyzer_analyzer,$scope.analyzer_text,
				function(response) {
					$scope.field_tokens = response;
				},
				function(error) {
					$scope.field_tokens = null;
					$scope.alert_service.error("Error while analyzing text", error);
				}
			);
		}
	}
	
	$scope.$on('hostChanged',function() {
		$scope.indices = $scope.cluster_service.cluster.indices;
	});
	
    $scope.$on('loadAnalysisEvent', function() {
		$scope.indices = $scope.cluster_service.cluster.indices;
    });
	
}
function ClusterHealthController($scope,$location,$timeout, AlertService) {
	$scope.alert_service = AlertService;
	$scope.shared_url = '';
	$scope.cluster_health = {};
	$scope.state = '';
	
    $scope.$on('loadClusterHealth', function() {
		$scope.cluster_health = null; // otherwise we see past version, then new
		$scope.state = ''; // informs about loading state
    });
	
	$scope.loadClusterHealth=function() {
		var cluster_health = null;
		$scope.cluster_health = null; // otherwise we see past version, then new
		$scope.state = "loading cluster health state. this could take a few moments..."
		$scope.client.getClusterDiagnosis(
			function(state, stats, hot_threads) {
				cluster_health = {};
				cluster_health['state'] = JSON.stringify(state, undefined, 4);
				cluster_health['stats'] = JSON.stringify(stats, undefined, 4);
				cluster_health['hot_threads'] = hot_threads;
				$scope.cluster_health = cluster_health;
				$scope.state = '';
			},
			function(failed_request) {
				$scope.state = '';
				$scope.modal.alert = new ErrorAlert("Error while retrieving cluster health information", failed_request.responseText);
		});
	}

	$scope.publishClusterHealth=function() {
		var gist = {};
		gist['description'] = 'Cluster information delivered by kopf';
		gist['public'] = true;
		gist['files'] = {};
		gist['files']['state'] = {'content': $scope.cluster_health['state'],'indent':'2', 'language':'JSON'};
		gist['files']['stats'] = {'content': $scope.cluster_health['stats'],'indent':'2', 'language':'JSON'} ;
		gist['files']['hot_threads'] = {'content':$scope.cluster_health['hot_threads'],'indent':'2', 'language':'JSON'};
		var data = JSON.stringify(gist, undefined, 4);
		$.ajax({ type: 'POST', url: "https://api.github.com/gists", dataType: 'json', data: data, async: false})
			.done(function(response) { 
				$scope.modal.alert = new SuccessAlert("Cluster health information successfully shared", "Gist available at : " + response.html_url);
			})
			.fail(function(response) {
				$scope.modal.alert = new ErrorAlert("Error while publishing Gist", responseText);
			}
		);
	}
}
function ClusterOverviewController($scope, $location, $timeout, IndexSettingsService, ClusterSettingsService, ConfirmDialogService, AlertService) {
	$scope.idxSettingsSrv = IndexSettingsService;
	$scope.cluster_service = ClusterSettingsService;
	$scope.dialog_service = ConfirmDialogService;
	$scope.pagination= new Pagination(1,"", []);
	$scope.cluster = null;
	$scope.alert_service = AlertService;
	
	(function loadClusterState() {
		
		$scope.isCurrentView=function() {
			return ($("#cluster_option").length > 0) ? $scope.isActive('cluster_option') : true;
		}
		
		$scope.updateCluster=function() {
			$scope.client.getClusterDetail(
				function(cluster) {
					$scope.$apply(function() { // forces view refresh
						$scope.cluster = cluster;
						$scope.cluster_service.cluster = cluster;
						$scope.pagination.setResults(cluster.indices);
					});
				},
				function(error) {
					$scope.alert_service.error("Error while retrieving cluster information", error);
				}
			);
		}
		$timeout(loadClusterState, $scope.getRefresh());	
		$scope.updateCluster();
	}());
	
	
	$scope.getNodes=function() {
		if ($scope.cluster != null) {
			return $scope.cluster.getNodes($scope.pagination.node_name, $scope.pagination.data,$scope.pagination.master,$scope.pagination.client);	
		}
	}
	
    $scope.$on('forceRefresh', function() {
		$scope.updateCluster();
    });
	
	$scope.closeModal=function(forced_refresh){
		if (forced_refresh) {
			$scope.forceRefresh(); // broadcasts so every controller gets the forceRefresg
		}
	}
	
	// actions invoked from view
	
	$scope.prepareCreateIndex=function() {
		$scope.broadcastMessage('prepareCreateIndex',{});
	}
	
	$scope.displayClusterHealth=function() {
		$scope.broadcastMessage('loadClusterHealth',{});
	}
	
	$scope.shutdown_node=function(node_id, node_name) {
		$scope.dialog_service.open(
			"are you sure you want to shutdown node " + node_name + "?",
			"Shutting down a node will make all data stored in this node inaccessible, unless this data is replicated across other nodes." +
			"Replicated shards will be promoted to primary if the primary shard is no longer reachable.",
			"Shutdown",
			function() {
				var response = $scope.client.shutdownNode(node_id,
					function(response) {
						$scope.alert_service.success("Node [" + node_id + "] successfully shutdown", response);
						$scope.updateCluster();
					},
					function(error) {
						$scope.alert_service.error("Error while shutting down node",error);
					}
				);
			}
		);
	}

	$scope.optimizeIndex=function(index){
		$scope.dialog_service.open(
			"are you sure you want to optimize index " + index + "?",
			"Optimizing an index is a resource intensive operation and should be done with caution."+
			"Usually, you will only want to optimize an index when it will no longer receive updates",
			"Optimize",
			function() {
				$scope.client.optimizeIndex(index, 
					function(response) {
						$scope.alert_service.success("Index was successfully optimized", response);
					},
					function(error) {
						$scope.alert_service.error("Error while optimizing index", error);
					}				
				);
			}
		);
	}
	
	$scope.deleteIndex=function(index) {
		$scope.dialog_service.open(
			"are you sure you want to delete index " + index + "?",
			"Deleting an index cannot be undone and all data for this index will be lost",
			"Delete",
			function() {
				$scope.client.deleteIndex(index, 
					function(response) {
						$scope.alert_service.success("Index was successfully deleted", response);
						$scope.updateCluster();
					},
					function(error) {
						$scope.alert_service.error("Error while deleting index", error);
					}	
				);
			}
		);
	}
	
	$scope.clearCache=function(index) {
		$scope.dialog_service.open(
			"are you sure you want to clear the cache for index " + index + "?",
			"This will clear all caches for this index.",
			"Clear",
			function() {
				$scope.client.clearCache(index,
					function(response) {
						$scope.alert_service.success("Index cache was successfully cleared", response);
						$scope.updateCluster();
					},
					function(error) {
						$scope.alert_service.error("Error while clearing index cache", error);
					}
				);
			}
		);
	}

	$scope.refreshIndex=function(index) {
		$scope.dialog_service.open(
			"are you sure you want to refresh index " + index + "?",
			"Refreshing an index makes all operations performed since the last refresh available for search.",
			"Refresh",
			function() {
				$scope.client.refreshIndex(index, 
					function(response) {
						$scope.alert_service.success("Index was successfully refreshed", response);
					},
					function(error) {
						$scope.alert_service.error("Error while refreshing index", error);	
					}
				);
			}
		);
	}
	
	$scope.enableAllocation=function() {
		var response = $scope.client.enableShardAllocation(
			function(response) {
				$scope.alert_service.success("Shard allocation was successfully enabled", response);
				$scope.updateCluster();
			},
			function(error) {
				$scope.alert_service.error("Error while enabling shard allocation", error);	
				$scope.updateCluster();
			}
		);
	}
	
	$scope.disableAllocation=function(current_state) {
		var response = $scope.client.disableShardAllocation(
			function(response) {
				$scope.alert_service.success("Shard allocation was successfully disabled", response);
				$scope.updateCluster();
			},
			function(error) {
				$scope.alert_service.error("Error while disabling shard allocation", error);	
				$scope.updateCluster();
			}
		);
	}
	
	$scope.closeIndex=function(index) {
		$scope.dialog_service.open(
			"are you sure you want to close index " + index + "?",
			"Closing an index will remove all it's allocated shards from the cluster. " +
			"Both searches and updates will no longer be accepted for the index." +
			"A closed index can be reopened at any time",
			"Close index",
			function() {
				$scope.client.closeIndex(index, 
					function(response) {
						$scope.alert_service.success("Index was successfully closed", response);
						$scope.updateCluster();
					},
					function(error) {
						$scope.alert_service.error("Error while closing index", error);	
					}
				);
			}
		);
	}
	
	$scope.openIndex=function(index) {
		$scope.dialog_service.open(
			"are you sure you want to open index " + index + "?",
			"Opening an index will trigger the recovery process for the index. " +
			"This process could take sometime depending on the index size.",
			"Open index",
			function() {
				$scope.client.openIndex(index,
					function(response) {
						$scope.alert_service.success("Index was successfully opened", response);
						$scope.updateCluster();
					},
					function(error) {
						$scope.alert_service.error("Error while opening index", error);
					}
				);
			}
		);
	}
	
	$scope.loadIndexSettings=function(index) {
		$('#index_settings_option a').tab('show');
		var indices = $scope.cluster.indices.filter(function(i) {
			return i.name == index;
		});
		$scope.idxSettingsSrv.index = indices[0];
		$('#idx_settings_tabs a:first').tab('show');		
	}
	
	$scope.loadClusterSettings=function() {
		$('#cluster_settings_option a').tab('show');
		$('#cluster_settings_tabs a:first').tab('show');		
	}
}
function ClusterSettingsController($scope, $location, $timeout, ClusterSettingsService, AlertService) {
	$scope.alert_service = AlertService;
	$scope.cluster_service = ClusterSettingsService;

	$scope.back=function() {
		$('#cluster_option a').tab('show');
	}

	$scope.save=function() {
			var new_settings = {};
			new_settings['transient'] = $scope.cluster_service.cluster.settings;
			var response = $scope.client.updateClusterSettings(JSON.stringify(new_settings, undefined, ""),
				function(response) {
					$scope.alert_service.success("Cluster settings were successfully updated",response);
					$scope.forceRefresh();
				}, 
				function(error) {
					$scope.alert_service.error("Error while updating cluster settings",error);
				}
		);
	}
}
function CreateIndexController($scope, $location, $timeout, AlertService) {
	$scope.alert_service = AlertService;
	$scope.settings = '';
	$scope.shards = '';
	$scope.replicas = '';
	$scope.name = '';

	$scope.editor = new AceEditor('index-settings-editor');
	
    $scope.$on('prepareCreateIndex', function() {
		$scope.prepareCreateIndex();
    });

	$scope.createIndex=function() {
		if ($scope.name.trim().length == 0) {
			$scope.modal.alert = new ErrorAlert("You must specify a valid index name", null);	
		} else {
			var settings = {};
			var content = $scope.editor.getValue();
			if (content.trim().length > 0) {
				try {
					settings = JSON.parse(content);
				} catch (error) {
					throw "Invalid JSON: " + error;
				}
			} 
			if (!isDefined(settings['settings'])) {
				settings = {"settings":settings};
			} 
			if (!isDefined(settings['settings']['index'])) {
				settings['settings']['index'] = {};
			} 
			var index_settings = settings['settings']['index'];
			if ($scope.shards.trim().length > 0) {
				index_settings['number_of_shards'] = $scope.shards;
			}
			if ($scope.replicas.trim().length > 0) {
				index_settings['number_of_replicas'] = $scope.replicas;
			}
			$scope.client.createIndex($scope.name, JSON.stringify(settings, undefined, ""), 
				function(response) {
					$scope.modal.alert = new SuccessAlert('Index successfully created', response);
					$scope.forceRefresh();					
				}, function(error) { 
					$scope.modal.alert = new ErrorAlert("Error while creating index", error);
				}
			);
		}
	}
	
	$scope.prepareCreateIndex=function() {
		$scope.settings = "";
		$scope.editor.setValue("{}");
		$scope.shards = '';
		$scope.name = '';
		$scope.replicas = '';
	}
}
function GlobalController($scope, $location, $timeout, $sce, ConfirmDialogService, AlertService) {
	$scope.dialog = ConfirmDialogService;
	$scope.version = "0.3.1";
	$scope.username = null;
	$scope.password = null;
	$scope.alerts_service = AlertService;
	
	$scope.setConnected=function(status) {
		$scope.is_connected = status;
	}

	$scope.broadcastMessage=function(message,args) {
		$scope.$broadcast(message,args);
	}
	
	$scope.readParameter=function(name){
	    var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
		return (results != null) ? results[1] : null;
	}
	
	$scope.setHost=function(url) {
		var exp = /^(https|http):\/\/(\w+):(\w+)@(.*)/i;
		// expected: "http://user:password@host", "http", "user", "password", "host"]
		var url_parts = exp.exec(url);
		if (url_parts != null) {
			$scope.host = url_parts[1] + "://" + url_parts[4];
			$scope.username = url_parts[2];
			$scope.password = url_parts[3];
		} else {
			$scope.username = null;
			$scope.password = null;
			$scope.host = url;
		}
		$scope.setConnected(false);
		$scope.client = new ElasticClient($scope.host,$scope.username,$scope.password);
		$scope.broadcastMessage('hostChanged',{});
	}
	
	if ($location.host() == "") { // when opening from filesystem
		$scope.setHost("http://localhost:9200");
	} else {
		var location = $scope.readParameter('location');
		if (location != null) {
			$scope.setHost(location);
		} else {
			$scope.setHost($location.protocol() + "://" + $location.host() + ":" + $location.port());			
		}
 	}
	$scope.refresh = 3000;
	$scope.modal = new ModalControls();
	$scope.alert = null;
	$scope.is_connected = false;

	// should be called when an action could change status/topology of cluster
	$scope.forceRefresh=function() {
		$scope.broadcastMessage('forceRefresh',{});
	}

	$scope.hasConnection=function() {
		return $scope.is_connected;
	}
	
	$scope.isActive=function(tab) {
		return $('#' + tab).hasClass('active');
	}
	
	$scope.getHost=function() {
		return $scope.host;
	}
	
	$scope.setRefresh=function(refresh) {
		$scope.refresh = refresh;
	}
	
	$scope.getRefresh=function() {
		return $scope.refresh;
	}
	
	$scope.readablizeBytes=function(bytes) {
		if (bytes > 0) {
		    var s = ['b', 'KB', 'MB', 'GB', 'TB', 'PB'];
		    var e = Math.floor(Math.log(bytes) / Math.log(1024));
		    return (bytes / Math.pow(1024, e)).toFixed(2) + s[e];	
		} else {
			return 0;
		}
	}

	$scope.displayInfo=function(title,info) {
		$scope.modal.title = title;
		$scope.modal.info = $sce.trustAsHtml(jsonTree.create(info));
		$('#modal_info').modal({show:true,backdrop:true});
	}
	
	$scope.isInModal=function() {
		return ($('.modal-backdrop').length > 0);
	}
	
	$scope.getCurrentTime=function() {
		return getTimeString();
	}
	
}
function IndexSettingsController($scope, $location, $timeout, IndexSettingsService, AlertService) {
	$scope.alert_service = AlertService;
	$scope.service = IndexSettingsService;
	
	//index.cache.filter.max_size,index.cache.filter.expire
	var allowed_properties = [
		// INDEX
		'index.number_of_replicas', 
		'index.auto_expand_replicas', 
		'index.refresh_interval',
		'index.index_concurrency',
		'index.warmer.enabled',
		'index.term_index_interval',
		'index.term_index_divisor', 
		'index.recovery.initial_shards',
		'index.gc_deletes',
		'index.ttl.disable_purge',
		'index.fail_on_merge_failure',
		'index.codec',
		'index.compound_format',
		'index.compound_on_flush',
		// BLOCKS
		'index.blocks.read_only',
		'index.blocks.read',
		'index.blocks.write',
		'index.blocks.metadata',
		// TRANSLOG		
		'index.translog.flush_threshold_ops',
		'index.translog.flush_threshold_size', 
		'index.translog.flush_threshold_period',
		'index.translog.disable_flush',
		'index.translog.fs.type',
		// ROUTING
		'index.routing.allocation.disable_allocation',
		'index.routing.allocation.disable_new_allocation',
		'index.routing.allocation.disable_replica_allocation',
		'index.routing.allocation.total_shards_per_node',
		// CACHE
		'index.cache.filter.max_size',
		'index.cache.filter.expire',
		// SLOWLOG
		'index.search.slowlog.threshold.query.warn',
		'index.search.slowlog.threshold.query.info',
		'index.search.slowlog.threshold.query.debug',
		'index.search.slowlog.threshold.query.trace',
		'index.search.slowlog.threshold.fetch.warn',
		'index.search.slowlog.threshold.fetch.info',
		'index.search.slowlog.threshold.fetch.debug',
		'index.search.slowlog.threshold.fetch.trace',
		'index.indexing.slowlog.threshold.index.warn',
		'index.indexing.slowlog.threshold.index.info',
		'index.indexing.slowlog.threshold.index.debug',
		'index.indexing.slowlog.threshold.index.trace'
	];
	 
	 $scope.back=function() {
		 $('#cluster_option a').tab('show');
	 }

	 $scope.save=function() {
		 var index = $scope.service.index;
		 var new_settings = {};
		 allowed_properties.forEach(function(setting) {
			 if (isDefined(index.settings[setting]) && index.settings[setting].length > 0) {
				 new_settings[setting] = index.settings[setting];
			 }
		 });
		 $scope.client.updateIndexSettings(index.name, JSON.stringify(new_settings, undefined, ""),
			 function(response) {
				 $scope.alert_service.success("Index settings were successfully updated", response);
				 $scope.forceRefresh();
			 },
			 function(error) {
				 $scope.alert_service.error("Error while updating index settings", error);
			 }
		 );
	 }
 }
function NavbarController($scope, $location, $timeout, AlertService) {
	$scope.alert_service = AlertService;
	$scope.new_refresh = $scope.getRefresh();
	$scope.cluster_health = null;
	
	(function loadClusterHealth() {
		
		$scope.updateClusterHealth=function() {
			$scope.client.getClusterHealth( 
				function(cluster) {
					$scope.cluster_health = cluster;
					$scope.setConnected(true);
				},
				function(error) {
					$scope.cluster_health = null;
					$scope.setConnected(false);
					$scope.alert_service.error("Error connecting to [" + $scope.host + "]",error);
				}
			);
		}
		
    	$timeout(loadClusterHealth, $scope.refresh);
		$scope.updateClusterHealth();
	}());
	
    $scope.$on('forceRefresh', function() {
		$scope.updateClusterHealth();
    });
	
    $scope.connectToHost=function() {
		if (isDefined($scope.new_host) && $scope.new_host.length > 0) {
			$scope.setHost($scope.new_host);
			$scope.cluster_health = null;
			$scope.updateClusterHealth();
		}
	}
	
	$scope.changeRefresh=function() {
		$scope.setRefresh($scope.new_refresh);
	}

	$scope.selectTab=function(event) {
		$scope.alert_service.clear();
		if (isDefined(event)) {
			$scope.broadcastMessage(event, {});
		}
	}
}

function RestController($scope, $location, $timeout, AlertService) {
	$scope.alert_service = AlertService;
	
	$scope.request = new Request($scope.getHost() + "/_search","GET","{}");
	$scope.validation_error = null;
	$scope.history = [];
	$scope.history_request = null;
		
	$scope.editor = new AceEditor('rest-client-editor');
	$scope.editor.setValue($scope.request.body);
	
	$scope.loadFromHistory=function(history_request) {
		$scope.request.url = history_request.url;
		$scope.request.body = history_request.body;
		$scope.request.method = history_request.method;
		$scope.editor.setValue(history_request.body);
		$scope.history_request = null;
	}

	$scope.sendRequest=function() {
		$scope.request.body = $scope.editor.format();
		$('#rest-client-response').html('');
		if ($scope.editor.error == null && notEmpty($scope.request.url)) {
			try {
				// TODO: deal with basic auth here
				if ($scope.request.method == 'GET' && $scope.request.body.length > 1) {
					$scope.alert_service.info("You are executing a GET request with body content. Maybe you meant to use POST or PUT?");
				}
				$scope.client.executeRequest($scope.request.method,$scope.request.url,null,null,$scope.request.body,
					function(response) {
						var content = jsonTree.create(response);
						$('#rest-client-response').html(content);
						$scope.history.unshift(new Request($scope.request.url,$scope.request.method,$scope.request.body));
						if ($scope.history.length > 30) {
							$scope.history.length = 30;
						}
					},
					function(error) {
						try {
							$('#rest-client-response').html(jsonTree.create(JSON.parse(error)));
						} catch (invalid_json) {
							$scope.alert_service.error("Request did not return a valid JSON", invalid_json);
						}
					}
				);
			} catch (error) {
				$scope.alert_service.error("Error while executing request", error);
			}
		}
	}
}
function PercolatorController($scope, $location, $timeout, ConfirmDialogService, AlertService, ClusterSettingsService) {
	$scope.alert_service = AlertService;
	$scope.dialog_service = ConfirmDialogService;
	$scope.cluster_service = ClusterSettingsService;
	
	$scope.editor = new AceEditor('percolator-query-editor');
		
	$scope.total = 0;
	$scope.queries = [];
	$scope.page = 1;
	$scope.filter = "";
	$scope.id = "";
	
	$scope.index;
	$scope.indices = [];
	$scope.new_query = new PercolateQuery("","","");
	
	
    $scope.$on('loadPercolatorEvent', function() {
		$scope.loadIndices();
		$scope.loadPercolatorQueries();
    });
	
	$scope.previousPage=function() {
		$scope.page -= 1;
		$scope.loadPercolatorQueries();
	}
	
	$scope.nextPage=function() {
		$scope.page += 1;
		$scope.loadPercolatorQueries();
	}
	
	$scope.hasNextPage=function() {
		return $scope.page * 10 < $scope.total;
	}
	
	$scope.hasPreviousPage=function() {
		return $scope.page > 1;
	}
	
	$scope.firstResult=function() {
		return $scope.total > 0 ? ($scope.page - 1) * 10  + 1 : 0;
	}
	
	$scope.lastResult=function() {
		return $scope.hasNextPage() ? $scope.page * 10 : $scope.total;
	}
	
	$scope.parseSearchParams=function() {
		var queries = [];
		if ($scope.id.trim().length > 0) {
			queries.push({"term":{"_id":$scope.id}});
		}
		if ($scope.filter.trim().length > 0) {
			var filter = JSON.parse($scope.filter);
			Object.keys(filter).forEach(function(field) {
				var q = {};
				q[field] = filter[field];
				queries.push({"term": q});
			});
		}
		return queries;
	}
	
	$scope.deletePercolatorQuery=function(query) {
		$scope.dialog_service.open(
			"are you sure you want to delete query " + query.id + " for index " + query.type + "?",
			query.sourceAsJSON(),
			"Delete",
			function() {
				$scope.client.deletePercolatorQuery(query.type, query.id,
					function(response) {
						$scope.client.refreshIndex("_percolator", 
							function(response) {
								$scope.alert_service.success("Query successfully deleted", response);
								$scope.loadPercolatorQueries();
							},
							function(error) {
								$scope.alert_service.success("Error while reloading queries", error);
							}
						);
					},
					function(error) {
						$scope.alert_service.error("Error while deleting query", error);
					}
				);
			}
		);
	}
	
	$scope.createNewQuery=function() {
		$scope.new_query.source = $scope.editor.format();
		if ($scope.editor.error == null) {
			$scope.client.createPercolatorQuery($scope.new_query.index.name, $scope.new_query.id, $scope.new_query.source,
				function(response) {
					$scope.client.refreshIndex("_percolator", 
						function(response) {
							// non request action, no need to display
							$scope.alert_service.success("Percolator Query successfully created", response);
							$scope.loadPercolatorQueries();
						},
						function(error) {
							$scope.alert_service.success("Error while reloading queries", error);
						}
					);
				},
				function(error) {
					$scope.alert_service.error("Error while creating percolator query", error);
				}
			);
		}
	}
	
	$scope.loadPercolatorQueries=function() {
		var params = {};
		try {
			var queries = $scope.parseSearchParams();
			if (queries.length > 0) {
				params['query'] = {"bool": {"must": queries}};
			}
			params['from'] = (($scope.page - 1) * 10);
			var index = $scope.index != null ? $scope.index.name : null;
			$scope.client.fetchPercolateQueries(index, JSON.stringify(params),
				function(response) {
					$scope.total = response['hits']['total'];
					$scope.queries = response['hits']['hits'].map(function(q) { return new PercolateQuery(q); });
				},
				function(error) {
					if (!(error['responseJSON'] != null && error['responseJSON']['error'] == "IndexMissingException[[_percolator] missing]")) {
						$scope.alert_service.error("Error while reading loading percolate queries", error);
					}
				}
			);
		} catch (error) {
			$scope.alert_service.error("Filter is not a valid JSON");
			return;
		}
	}
	
	$scope.loadIndices=function() {
		$scope.indices = $scope.cluster_service.cluster.indices.filter(function(index) { return index != '_percolator' });
	}
}

function PercolateQuery(query_info) {
	this.type = query_info['_type'];
	this.id = query_info['_id'];
	this.source = query_info['_source'];
	
	this.sourceAsJSON=function() {
		try {
			return JSON.stringify(this.source,undefined, 2);
		} catch (error) {

		}
	}
}
function ConfirmDialogController($scope, $location, $timeout, ConfirmDialogService) {

	$scope.dialog_service = ConfirmDialogService;
	
	$scope.close=function() {
		$scope.dialog_service.close();
	}
	
	$scope.confirm=function() {
		$scope.dialog_service.confirm();
	}
	
}
function WarmupController($scope, $location, $timeout, ConfirmDialogService, ClusterSettingsService, AlertService) {
	$scope.alert_service = AlertService;	
	$scope.dialog_service = ConfirmDialogService;
	$scope.cluster_service = ClusterSettingsService;
	
	$scope.editor = ace.edit("warmup-query-editor");
	$scope.editor.setFontSize("10px");
	$scope.editor.setTheme("ace/theme/kopf");
	$scope.editor.getSession().setMode("ace/mode/json");

	$scope.indices = [];
	$scope.warmers = {};
	$scope.index = null;
	$scope.warmer_id = "";
	
	// holds data for new warmer. maybe create a model for that
	$scope.new_warmer_id = '';
	$scope.new_index = '';
	$scope.new_source = '';
	$scope.new_types = '';
	
    $scope.$on('loadWarmupEvent', function() {
		$scope.loadIndices();
    });
	
	$scope.totalWarmers=function() {
		return Object.keys($scope.warmers).length;
	}
	
	$scope.loadIndices=function() {
		$scope.indices = $scope.cluster_service.cluster.indices;
	}
	
	$scope.createWarmerQuery=function() {
		$scope.formatBody();
		if ($scope.validation_error == null) {
			$scope.client.registerWarmupQuery($scope.new_index.name, $scope.new_types, $scope.new_warmer_id, $scope.new_source,
				function(response) {
					$scope.alert_service.success("Warmup query successfully registered", response);
				},
				function(error) {
					$scope.alert_service.error("Request did not return a valid JSON", error);
				}
			);
		}
	}
	
	$scope.deleteWarmupQuery=function(warmer_id, source) {
		$scope.dialog_service.open(
			"are you sure you want to delete query " + warmer_id + "?",
			source,
			"Delete",
			function() {
				$scope.client.deleteWarmupQuery($scope.index.name, warmer_id,
					function(response) {
						$scope.alert_service.success("Warmup query successfully deleted", response);
						$scope.loadIndexWarmers();
					},
					function(error) {
						$scope.alert_service.error("Error while deleting warmup query", error);
					}
				);
			}
		);
	}
	
	$scope.loadIndexWarmers=function() {
		if ($scope.index != null) {
			$scope.client.getIndexWarmers($scope.index.name, $scope.warmer_id,
				function(response) {
					if (response[$scope.index.name] != null) {
						$scope.warmers = response[$scope.index.name]['warmers'];
					} else {
						$scope.warmers = {};
					}
				},
				function(error) {
					$scope.alert_service.error("Error while fetching warmup queries", error);
				}
			);
		} else {
			$scope.warmers = {};
		}
	}
	
	$scope.formatBody=function() {
		var source = $scope.editor.getValue();
		try {
			$scope.validation_error = null;
			var sourceObj = JSON.parse(source);
			var formattedSource = JSON.stringify(sourceObj,undefined,4);
			$scope.editor.setValue(formattedSource,0);
			$scope.editor.gotoLine(0,0,false);
			$scope.new_source = formattedSource;
		} catch (error) {
			$scope.validation_error = error.toString();
		}
	}
	
}
var Alert=function(message, response, level, _class, icon) {
	var current_date = new Date();
	this.message = message;
	this.response = response;
	this.level = level;
	this.class = _class;
	this.icon = icon;
	this.timestamp = getTimeString(current_date);
	this.id = "alert_box_" + current_date.getTime();
	
	this.hasResponse=function() {
		return this.response != null;
	}
	
	this.getResponse=function() {
		if (this.response != null) {
			return JSON.stringify(this.response, undefined, 2);			
		}
	}
}

kopf.factory('AlertService', function() {
	this.alerts = [];
	
	// removes ALL alerts
	this.clear=function() {
		this.alerts.length = 0;
	}
	
	// remove a particular alert message
	this.remove=function(id) {
		$("#" + id).fadeTo(1000, 0).slideUp(200, function(){
        	$(this).remove(); 
		});
		this.alerts = this.alerts.filter(function(a) { return id != a.id });
	}
	
	// creates an error alert
	this.error=function(message, response) {
		var alert = new Alert(message, response, "error", "alert-danger", "icon-warning-sign");
		this.alerts.unshift(alert);
		var service = this;
		setTimeout(function() { service.remove(alert.id) }, 30000);
	}
	
	// creates an info alert
	this.info=function(message, response) {
		var alert = new Alert(message, response, "info", "alert-info", "icon-info");
		this.alerts.unshift(alert);
		var service = this;
		setTimeout(function() { service.remove(alert.id) }, 5000);		
	}
	
	// creates success alert
	this.success=function(message, response) {
		var alert = new Alert(message, response, "success", "alert-success", "icon-ok");
		this.alerts.unshift(alert);
		var service = this;
		setTimeout(function() { service.remove(alert.id) }, 5000);
	}
	
	return this;
});
function AceEditor(target) {
	// ace editor
	this.editor = ace.edit(target);
	this.editor.setFontSize("10px");
	this.editor.setTheme("ace/theme/kopf");
	this.editor.getSession().setMode("ace/mode/json");
	
	// validation error
	this.error = null;
	
	// sets value and moves cursor to beggining
	this.setValue=function(value) {
		this.editor.setValue(value,1);
		this.editor.gotoLine(0,0,false);
	}
	
	this.getValue=function() {
		return this.editor.getValue();
	}
	
	// formats the json content
	this.format=function() {
		var content = this.editor.getValue();
		try {
			if (typeof content != 'undefined' && content != null && content.trim().length > 0) {
				this.error = null;
				content = JSON.stringify(JSON.parse(content),undefined,4);
				this.editor.setValue(content,0);
				this.editor.gotoLine(0,0,false);
			}
		} catch (error) {
			this.error = error.toString();
		}
		return content;
	}
}