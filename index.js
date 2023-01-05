import {
  ECSClient,
  ListClustersCommand,
  ListServicesCommand,
  DescribeServicesCommand,
  DescribeTaskDefinitionCommand,
  DeleteClusterCommand,
} from "@aws-sdk/client-ecs";

const client = new ECSClient({ region: "us-east-1" });

const listClusters = async () => {
  let totalClusters = [];
  console.log("listing clusters...");
  const command = new ListClustersCommand({});
  const response = await client.send(command);
  console.log(response);
  totalClusters.push(...response.clusterArns);
  console.log("array size = ", totalClusters.length);
  let nextToken = response.nextToken;
  while (nextToken) {
    console.log("listing clusters... next token");
    const command2 = new ListClustersCommand({
      nextToken: response.nextToken,
    });
    const response2 = await client.send(command2);
    console.log(response2);
    totalClusters.push(...response2.clusterArns);
    console.log("array size = ", totalClusters.length);
    nextToken = response2.nextToken;
  }
  return totalClusters;
};

const listServicesByCluster = async (clusterARN) => {
  let totalServices = [];
  const command = new ListServicesCommand({
    cluster: clusterARN,
  });
  const response = await client.send(command);
  totalServices.push(...response.serviceArns);
  let nextToken = response.nextToken;
  while (nextToken) {
    const command = new ListServicesCommand({
      cluster: clusterARN,
      nextToken: nextToken,
    });
    const response = await client.send(command);
    totalServices.push(...response.serviceArns);
    nextToken = response.nextToken;
  }
  console.log(totalServices);
  return totalServices;
};

const getServicesDetails = async (services, clusterARN) => {
  if (services.length == 0) return [];
  let servicesDetails = [];
  console.log("asi llegan los services", services);
  let firstBatch = services.slice(0, 10);
  services.splice(0, 10);
  const command = new DescribeServicesCommand({
    services: firstBatch,
    cluster: clusterARN,
  });
  const response = await client.send(command);
  let taskDefinitionDetails = await getTaskDefinitionDetailsBatch(
    response.services
  );
  servicesDetails.push(...taskDefinitionDetails);
  while (services.length > 0) {
    let batch = services.slice(0, 10);
    services.splice(0, 10);
    const command = new DescribeServicesCommand({
      services: batch,
      cluster: clusterARN,
    });
    const response = await client.send(command);
    let taskDefinitionDetails = await getTaskDefinitionDetailsBatch(
      response.services
    );
    servicesDetails.push(...taskDefinitionDetails);
  }
  return servicesDetails;
};

const main = async () => {
  let clusters = await listClusters();
  let finalList = [];

  for (let cluster of clusters) {
    let services = await listServicesByCluster(cluster);
    let servicesDetails = await getServicesDetails(services, cluster);
    finalList.push(...servicesDetails);
  }

  console.log(
    "------==========================================================================================------"
  );
  console.log(finalList[0]);

  let totalCPU = 0;
  let totalRAM = 0;

  for (let item of finalList) {
    totalCPU += item.runningCount * item.taskDefinitionDetails.cpu;
    totalRAM += item.runningCount * item.taskDefinitionDetails.memory;
  }

  console.log("CPU total (vCPU) =", totalCPU / 1024);
  console.log("RAM total (GB) =", totalRAM / 1024);
};

main();

const getTaskDefinitionDetailsBatch = async (services) => {
  let list = [];
  for (let service of services) {
    let taskDefinitionDetail = await getTaskDefinitionDetails(
      service.taskDefinition
    );
    delete service.events;
    list.push({
      ...service,
      taskDefinitionDetails: taskDefinitionDetail,
    });
  }
  return list;
};

const getTaskDefinitionDetails = async (taskDefinition) => {
  const command = new DescribeTaskDefinitionCommand({
    taskDefinition,
  });
  const response = await client.send(command);
  console.log(response.taskDefinition);
  return response.taskDefinition;
};
