import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { CapacityType, KubernetesVersion } from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
export interface BlueprintConstructProps {
    id: string
}

/**
 * // AmazonSSMManagedInstanceCore role is added to connect to EC2 instances by using SSM on AWS web console
 */
export default class EksBlueprintStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const vpcId = this.node.tryGetContext('vpcId') || ssm.StringParameter.valueFromLookup(this, '/cdk-eks-blueprints/vpc-id');
        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.ClusterAutoScalerAddOn,
            new blueprints.addons.AwsLoadBalancerControllerAddOn,
            new blueprints.addons.MetricsServerAddOn,
            new blueprints.addons.ContainerInsightsAddOn,
            new blueprints.addons.VpcCniAddOn,
            new blueprints.addons.CoreDnsAddOn,
            new blueprints.addons.KubeProxyAddOn
        ];
        const clusterProvider = new blueprints.GenericClusterProvider({
            version: KubernetesVersion.V1_21,
            managedNodeGroups: [{
                id: "cpu-ng",
                minSize: 2,
                maxSize: 10,
                instanceTypes: [new ec2.InstanceType('c5.large')],
                nodeGroupCapacityType: CapacityType.SPOT,
            }]
        });
        const eksBlueprint = blueprints.EksBlueprint.builder()
            .addOns(...addOns)
            .resourceProvider(blueprints.GlobalResources.Vpc, new blueprints.VpcProvider(vpcId))
            .clusterProvider(clusterProvider)
            .enableControlPlaneLogTypes('api')
            .build(this, 'build', props);

        eksBlueprint.getClusterInfo().nodeGroups?.forEach(n => {
            n.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
        });

        new CfnOutput(this, 'ClusterName', { value: eksBlueprint.getClusterInfo().cluster.clusterName });
        new CfnOutput(this, 'ClusterArn', { value: eksBlueprint.getClusterInfo().cluster.clusterArn });
    }
}