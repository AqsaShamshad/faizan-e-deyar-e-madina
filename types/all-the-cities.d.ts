declare module "all-the-cities" {
  type City = {
    name: string;
    country: string;
    featureCode: string;
    population: number;
  };

  const cities: City[];
  export default cities;
}
