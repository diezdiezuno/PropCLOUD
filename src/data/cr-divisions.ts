// Costa Rica: Provincias → Cantones → Distritos

export interface District { name: string }
export interface Canton   { name: string; districts: District[] }
export interface Province { name: string; cantons: Canton[] }

export const CR_DIVISIONS: Province[] = [
  {
    name: 'San José',
    cantons: [
      { name: 'San José', districts: [{ name: 'Carmen' }, { name: 'Merced' }, { name: 'Hospital' }, { name: 'Catedral' }, { name: 'Zapote' }, { name: 'San Francisco de Dos Ríos' }, { name: 'Uruca' }, { name: 'Mata Redonda' }, { name: 'Pavas' }, { name: 'Hatillo' }, { name: 'San Sebastián' }] },
      { name: 'Escazú', districts: [{ name: 'Escazú' }, { name: 'San Antonio' }, { name: 'San Rafael' }] },
      { name: 'Desamparados', districts: [{ name: 'Desamparados' }, { name: 'San Miguel' }, { name: 'San Juan de Dios' }, { name: 'San Rafael Arriba' }, { name: 'San Antonio' }, { name: 'Frailes' }, { name: 'Patarrá' }, { name: 'San Cristóbal' }, { name: 'Rosario' }, { name: 'Damas' }, { name: 'San Rafael Abajo' }, { name: 'Gravilias' }, { name: 'Los Guido' }] },
      { name: 'Puriscal', districts: [{ name: 'Santiago' }, { name: 'Mercedes Sur' }, { name: 'Barbacoas' }, { name: 'Grifo Alto' }, { name: 'San Rafael' }, { name: 'Candelarita' }, { name: 'Desamparaditos' }, { name: 'San Antonio' }, { name: 'Chires' }] },
      { name: 'Tarrazú', districts: [{ name: 'San Marcos' }, { name: 'San Lorenzo' }, { name: 'San Carlos' }] },
      { name: 'Aserrí', districts: [{ name: 'Aserrí' }, { name: 'Tarbaca' }, { name: 'Vuelta de Jorco' }, { name: 'San Gabriel' }, { name: 'La Legua' }, { name: 'Monterrey' }, { name: 'Salitrillos' }] },
      { name: 'Mora', districts: [{ name: 'Colón' }, { name: 'Guayabo' }, { name: 'Tabarcia' }, { name: 'Piedras Negras' }, { name: 'Picagres' }, { name: 'Jaris' }, { name: 'Quitirrisí' }] },
      { name: 'Goicoechea', districts: [{ name: 'Guadalupe' }, { name: 'San Francisco' }, { name: 'Calle Blancos' }, { name: 'Mata de Plátano' }, { name: 'Ipís' }, { name: 'Rancho Redondo' }, { name: 'Purral' }] },
      { name: 'Santa Ana', districts: [{ name: 'Santa Ana' }, { name: 'Salitral' }, { name: 'Pozos' }, { name: 'Uruca' }, { name: 'Piedades' }, { name: 'Brasil' }] },
      { name: 'Alajuelita', districts: [{ name: 'Alajuelita' }, { name: 'San Josecito' }, { name: 'San Antonio' }, { name: 'Concepción' }, { name: 'San Felipe' }] },
      { name: 'Vásquez de Coronado', districts: [{ name: 'San Isidro' }, { name: 'San Rafael' }, { name: 'Dulce Nombre de Jesús' }, { name: 'Patalillo' }, { name: 'Cascajal' }] },
      { name: 'Acosta', districts: [{ name: 'San Ignacio' }, { name: 'Guaitil' }, { name: 'Palmichal' }, { name: 'Cangrejal' }, { name: 'Sabanillas' }] },
      { name: 'Tibás', districts: [{ name: 'San Juan' }, { name: 'Cinco Esquinas' }, { name: 'Anselmo Llorente' }, { name: 'León XIII' }, { name: 'Colima' }] },
      { name: 'Moravia', districts: [{ name: 'San Vicente' }, { name: 'San Jerónimo' }, { name: 'La Trinidad' }] },
      { name: 'Montes de Oca', districts: [{ name: 'San Pedro' }, { name: 'Sabanilla' }, { name: 'Mercedes' }, { name: 'San Rafael' }] },
      { name: 'Turrubares', districts: [{ name: 'San Pablo' }, { name: 'San Pedro' }, { name: 'San Juan de Mata' }, { name: 'San Luis' }, { name: 'Carara' }] },
      { name: 'Dota', districts: [{ name: 'Santa María' }, { name: 'Jardín' }, { name: 'Copey' }] },
      { name: 'Curridabat', districts: [{ name: 'Curridabat' }, { name: 'Granadilla' }, { name: 'Sánchez' }, { name: 'Tirrases' }] },
      { name: 'Pérez Zeledón', districts: [{ name: 'San Isidro de El General' }, { name: 'El General' }, { name: 'Daniel Flores' }, { name: 'Rivas' }, { name: 'San Pedro' }, { name: 'Platanares' }, { name: 'Pejibaye' }, { name: 'Cajón' }, { name: 'Barú' }, { name: 'Río Nuevo' }, { name: 'Páramo' }, { name: 'La Amistad' }] },
      { name: 'León Cortés Castro', districts: [{ name: 'San Pablo' }, { name: 'San Andrés' }, { name: 'Llano Bonito' }, { name: 'San Isidro' }, { name: 'Santa Cruz' }, { name: 'San Antonio' }] },
    ],
  },
  {
    name: 'Alajuela',
    cantons: [
      { name: 'Alajuela', districts: [{ name: 'Alajuela' }, { name: 'San José' }, { name: 'Carrizal' }, { name: 'San Antonio' }, { name: 'Guácima' }, { name: 'San Isidro' }, { name: 'Sabanilla' }, { name: 'San Rafael' }, { name: 'Río Segundo' }, { name: 'Desamparados' }, { name: 'Turrúcares' }, { name: 'Tambor' }, { name: 'Garita' }, { name: 'Sarapiquí' }] },
      { name: 'San Ramón', districts: [{ name: 'San Ramón' }, { name: 'Santiago' }, { name: 'San Juan' }, { name: 'Piedades Norte' }, { name: 'Piedades Sur' }, { name: 'San Rafael' }, { name: 'San Isidro' }, { name: 'Los Ángeles' }, { name: 'Alfaro' }, { name: 'Volio' }, { name: 'Concepción' }, { name: 'Zapotal' }, { name: 'Peñas Blancas' }, { name: 'San Lorenzo' }] },
      { name: 'Grecia', districts: [{ name: 'Grecia' }, { name: 'San Isidro' }, { name: 'San José' }, { name: 'San Roque' }, { name: 'Tacares' }, { name: 'Río Cuarto' }, { name: 'Puente de Piedra' }, { name: 'Bolívar' }] },
      { name: 'San Mateo', districts: [{ name: 'San Mateo' }, { name: 'Desmonte' }, { name: 'Jesús María' }, { name: 'Labrador' }] },
      { name: 'Atenas', districts: [{ name: 'Atenas' }, { name: 'Jesús' }, { name: 'Mercedes' }, { name: 'San Isidro' }, { name: 'Concepción' }, { name: 'San José' }, { name: 'Santa Eulalia' }, { name: 'Escobal' }] },
      { name: 'Naranjo', districts: [{ name: 'Naranjo' }, { name: 'San Miguel' }, { name: 'San José' }, { name: 'Cirrí Sur' }, { name: 'San Jerónimo' }, { name: 'San Juan' }, { name: 'El Rosario' }, { name: 'Palmitos' }] },
      { name: 'Palmares', districts: [{ name: 'Palmares' }, { name: 'Zaragoza' }, { name: 'Buenos Aires' }, { name: 'Santiago' }, { name: 'Candelaria' }, { name: 'Esquipulas' }, { name: 'La Granja' }] },
      { name: 'Poás', districts: [{ name: 'San Juan' }, { name: 'San Luis' }, { name: 'San Pedro' }, { name: 'San Juan' }, { name: 'Carrillos' }, { name: 'Sabana Redonda' }] },
      { name: 'Orotina', districts: [{ name: 'Orotina' }, { name: 'El Mastate' }, { name: 'Hacienda Vieja' }, { name: 'Coyolar' }, { name: 'La Ceiba' }] },
      { name: 'San Carlos', districts: [{ name: 'Ciudad Quesada' }, { name: 'Florencia' }, { name: 'Buenavista' }, { name: 'Aguas Zarcas' }, { name: 'Venecia' }, { name: 'Pital' }, { name: 'La Fortuna' }, { name: 'La Tigra' }, { name: 'La Palmera' }, { name: 'Venado' }, { name: 'Cutris' }, { name: 'Monterrey' }, { name: 'Pocosol' }] },
      { name: 'Zarcero', districts: [{ name: 'Zarcero' }, { name: 'Laguna' }, { name: 'Tapesco' }, { name: 'Guadalupe' }, { name: 'Palmira' }, { name: 'Zapote' }, { name: 'Brisas' }] },
      { name: 'Sarchí', districts: [{ name: 'Sarchí Norte' }, { name: 'Sarchí Sur' }, { name: 'Toro Amarillo' }, { name: 'San Pedro' }, { name: 'Rodríguez' }] },
      { name: 'Upala', districts: [{ name: 'Upala' }, { name: 'Aguas Claras' }, { name: 'San José o Pizote' }, { name: 'Bijagua' }, { name: 'Delicias' }, { name: 'Dos Ríos' }, { name: 'Yolillal' }, { name: 'Canalete' }] },
      { name: 'Los Chiles', districts: [{ name: 'Los Chiles' }, { name: 'Caño Negro' }, { name: 'El Amparo' }, { name: 'San Jorge' }] },
      { name: 'Guatuso', districts: [{ name: 'San Rafael' }, { name: 'Buenavista' }, { name: 'Cote' }, { name: 'Katira' }] },
    ],
  },
  {
    name: 'Cartago',
    cantons: [
      { name: 'Cartago', districts: [{ name: 'Oriental' }, { name: 'Occidental' }, { name: 'Carmen' }, { name: 'San Nicolás' }, { name: 'Aguacaliente' }, { name: 'Guadalupe' }, { name: 'Corralillo' }, { name: 'Tierra Blanca' }, { name: 'Dulce Nombre' }, { name: 'Llano Grande' }, { name: 'Quebradilla' }] },
      { name: 'Paraíso', districts: [{ name: 'Paraíso' }, { name: 'Santiago' }, { name: 'Orosi' }, { name: 'Cachí' }, { name: 'Llanos de Santa Lucía' }] },
      { name: 'La Unión', districts: [{ name: 'Tres Ríos' }, { name: 'San Diego' }, { name: 'San Juan' }, { name: 'San Rafael' }, { name: 'Concepción' }, { name: 'Dulce Nombre' }, { name: 'San Ramón' }, { name: 'Río Azul' }] },
      { name: 'Jiménez', districts: [{ name: 'Juan Viñas' }, { name: 'Tucurrique' }, { name: 'Pejibaye' }] },
      { name: 'Turrialba', districts: [{ name: 'Turrialba' }, { name: 'La Suiza' }, { name: 'Peralta' }, { name: 'Santa Cruz' }, { name: 'Santa Teresita' }, { name: 'Pavones' }, { name: 'Tuis' }, { name: 'Tayutic' }, { name: 'Santa Rosa' }, { name: 'Tres Equis' }, { name: 'La Isabel' }, { name: 'Chirripó' }] },
      { name: 'Alvarado', districts: [{ name: 'Pacayas' }, { name: 'Cervantes' }, { name: 'Capellades' }] },
      { name: 'Oreamuno', districts: [{ name: 'San Rafael' }, { name: 'Cot' }, { name: 'Potrero Cerrado' }, { name: 'Cipreses' }, { name: 'Santa Rosa' }] },
      { name: 'El Guarco', districts: [{ name: 'El Tejar' }, { name: 'San Isidro' }, { name: 'Tobosi' }, { name: 'Patio de Agua' }] },
    ],
  },
  {
    name: 'Heredia',
    cantons: [
      { name: 'Heredia', districts: [{ name: 'Heredia' }, { name: 'Mercedes' }, { name: 'San Francisco' }, { name: 'Ulloa' }, { name: 'Varablanca' }] },
      { name: 'Barva', districts: [{ name: 'Barva' }, { name: 'San Pedro' }, { name: 'San Pablo' }, { name: 'San Roque' }, { name: 'Santa Lucía' }, { name: 'San José de la Montaña' }] },
      { name: 'Santo Domingo', districts: [{ name: 'Santo Domingo' }, { name: 'San Vicente' }, { name: 'San Miguel' }, { name: 'Paracito' }, { name: 'Santo Tomás' }, { name: 'Santa Rosa' }, { name: 'Tures' }, { name: 'Pará' }] },
      { name: 'Santa Bárbara', districts: [{ name: 'Santa Bárbara' }, { name: 'San Pedro' }, { name: 'San Juan' }, { name: 'Jesús' }, { name: 'Santo Domingo' }, { name: 'Puraba' }] },
      { name: 'San Rafael', districts: [{ name: 'San Rafael' }, { name: 'San Josecito' }, { name: 'Santiago' }, { name: 'Ángeles' }, { name: 'Concepción' }] },
      { name: 'San Isidro', districts: [{ name: 'San Isidro' }, { name: 'San José' }, { name: 'Concepción' }, { name: 'San Francisco' }] },
      { name: 'Belén', districts: [{ name: 'San Antonio' }, { name: 'La Ribera' }, { name: 'La Asunción' }] },
      { name: 'Flores', districts: [{ name: 'San Joaquín' }, { name: 'Barrantes' }, { name: 'Llorente' }] },
      { name: 'San Pablo', districts: [{ name: 'San Pablo' }, { name: 'Rincón de Sabanilla' }] },
      { name: 'Sarapiquí', districts: [{ name: 'Puerto Viejo' }, { name: 'La Virgen' }, { name: 'Las Horquetas' }, { name: 'Llanuras del Gaspar' }, { name: 'Cureña' }] },
    ],
  },
  {
    name: 'Guanacaste',
    cantons: [
      { name: 'Liberia', districts: [{ name: 'Liberia' }, { name: 'Cañas Dulces' }, { name: 'Mayorga' }, { name: 'Nacascolo' }, { name: 'Curubandé' }] },
      { name: 'Nicoya', districts: [{ name: 'Nicoya' }, { name: 'Mansión' }, { name: 'San Antonio' }, { name: 'Quebrada Honda' }, { name: 'Sámara' }, { name: 'Nosara' }, { name: 'Belén de Nosarita' }] },
      { name: 'Santa Cruz', districts: [{ name: 'Santa Cruz' }, { name: 'Bolsón' }, { name: 'Véintisiete de Abril' }, { name: 'Tempate' }, { name: 'Cartagena' }, { name: 'Cuajiniquil' }, { name: 'Diriá' }, { name: 'Cabo Velas' }, { name: 'Tamarindo' }] },
      { name: 'Bagaces', districts: [{ name: 'Bagaces' }, { name: 'La Fortuna' }, { name: 'Mogote' }, { name: 'Río Naranjo' }] },
      { name: 'Carrillo', districts: [{ name: 'Filadelfia' }, { name: 'Palmira' }, { name: 'Sardinal' }, { name: 'Belén' }] },
      { name: 'Cañas', districts: [{ name: 'Cañas' }, { name: 'Palmira' }, { name: 'San Miguel' }, { name: 'Bebedero' }, { name: 'Porozal' }] },
      { name: 'Abangares', districts: [{ name: 'Las Juntas' }, { name: 'Sierra' }, { name: 'San Juan' }, { name: 'Colorado' }] },
      { name: 'Tilarán', districts: [{ name: 'Tilarán' }, { name: 'Quebrada Grande' }, { name: 'Tronadora' }, { name: 'Santa Rosa' }, { name: 'Líbano' }, { name: 'Tierras Morenas' }, { name: 'Arenal' }, { name: 'Cabeceras' }] },
      { name: 'Nandayure', districts: [{ name: 'Carmona' }, { name: 'Santa Rita' }, { name: 'Zapotal' }, { name: 'San Pablo' }, { name: 'Porvenir' }, { name: 'Bejuco' }] },
      { name: 'La Cruz', districts: [{ name: 'La Cruz' }, { name: 'Santa Cecilia' }, { name: 'La Garita' }, { name: 'Santa Elena' }] },
      { name: 'Hojancha', districts: [{ name: 'Hojancha' }, { name: 'Monte Romo' }, { name: 'Puerto Carrillo' }, { name: 'Huacas' }, { name: 'Matambú' }] },
    ],
  },
  {
    name: 'Puntarenas',
    cantons: [
      { name: 'Puntarenas', districts: [{ name: 'Puntarenas' }, { name: 'Pitahaya' }, { name: 'Chomes' }, { name: 'Lepanto' }, { name: 'Paquera' }, { name: 'Manzanillo' }, { name: 'Guacimal' }, { name: 'Barranca' }, { name: 'Monte Verde' }, { name: 'Isla del Coco' }, { name: 'Cóbano' }, { name: 'Chacarita' }, { name: 'Chira' }, { name: 'Acapulco' }, { name: 'El Roble' }, { name: 'Arancibia' }] },
      { name: 'Esparza', districts: [{ name: 'Espíritu Santo' }, { name: 'San Juan Grande' }, { name: 'Macacona' }, { name: 'San Rafael' }, { name: 'San Jerónimo' }, { name: 'Caldera' }] },
      { name: 'Buenos Aires', districts: [{ name: 'Buenos Aires' }, { name: 'Volcán' }, { name: 'Potrero Grande' }, { name: 'Boruca' }, { name: 'Pilas' }, { name: 'Colinas' }, { name: 'Chánguena' }, { name: 'Biolley' }, { name: 'Brunka' }] },
      { name: 'Montes de Oro', districts: [{ name: 'Miramar' }, { name: 'La Unión' }, { name: 'San Isidro' }] },
      { name: 'Osa', districts: [{ name: 'Puerto Cortés' }, { name: 'Palmar' }, { name: 'Sierpe' }, { name: 'Bahía Ballena' }, { name: 'Piedras Blancas' }, { name: 'Bahía Drake' }] },
      { name: 'Quepos', districts: [{ name: 'Quepos' }, { name: 'Savegre' }, { name: 'Naranjito' }] },
      { name: 'Golfito', districts: [{ name: 'Golfito' }, { name: 'Puerto Jiménez' }, { name: 'Guaycará' }, { name: 'Pavón' }] },
      { name: 'Coto Brus', districts: [{ name: 'San Vito' }, { name: 'Sabalito' }, { name: 'Aguabuena' }, { name: 'Limoncito' }, { name: 'Pittier' }, { name: 'Gutiérrez Braun' }] },
      { name: 'Parrita', districts: [{ name: 'Parrita' }] },
      { name: 'Corredores', districts: [{ name: 'Corredor' }, { name: 'La Cuesta' }, { name: 'Canoas' }, { name: 'Laurel' }] },
      { name: 'Garabito', districts: [{ name: 'Jacó' }, { name: 'Tárcoles' }, { name: 'Lagunillas' }] },
    ],
  },
  {
    name: 'Limón',
    cantons: [
      { name: 'Limón', districts: [{ name: 'Limón' }, { name: 'Valle La Estrella' }, { name: 'Río Blanco' }, { name: 'Matama' }] },
      { name: 'Pococí', districts: [{ name: 'Guápiles' }, { name: 'Jiménez' }, { name: 'La Rita' }, { name: 'Roxana' }, { name: 'Cariari' }, { name: 'Colorado' }, { name: 'La Colonia' }] },
      { name: 'Siquirres', districts: [{ name: 'Siquirres' }, { name: 'Pacuarito' }, { name: 'Florida' }, { name: 'Germania' }, { name: 'El Cairo' }, { name: 'Alegría' }, { name: 'Reventazón' }] },
      { name: 'Talamanca', districts: [{ name: 'Bratsi' }, { name: 'Sixaola' }, { name: 'Cahuita' }, { name: 'Telire' }] },
      { name: 'Matina', districts: [{ name: 'Matina' }, { name: 'Batán' }, { name: 'Carrandi' }] },
      { name: 'Guácimo', districts: [{ name: 'Guácimo' }, { name: 'Mercedes' }, { name: 'Pocora' }, { name: 'Río Jiménez' }, { name: 'Duacarí' }] },
    ],
  },
]

export function getCantons(provinceName: string): Canton[] {
  return CR_DIVISIONS.find(p => p.name === provinceName)?.cantons ?? []
}

export function getDistricts(provinceName: string, cantonName: string): District[] {
  return getCantons(provinceName).find(c => c.name === cantonName)?.districts ?? []
}
